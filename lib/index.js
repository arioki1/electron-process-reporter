"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const memoize = require("memoizee");
// @ts-ignore: no declaration file
const pidtree = require("pidtree");
// @ts-ignore: no declaration file
const pidusage = require("pidusage");
const rxjs_1 = require("rxjs");
const extractURLDomain_1 = require("./extractURLDomain");
exports.getPidUsage = (pid) => {
    return pidtree(pid, { root: true })
        .then(pidusage)
        .then((usages) => Object.values(usages).filter(Boolean));
};
let getSharedProcessMetricsPollerByPid = (pid, samplingInterval) => rxjs_1.Observable.timer(0, samplingInterval)
    .map(() => rxjs_1.Observable.fromPromise(exports.getPidUsage(pid)))
    .mergeAll()
    .share();
getSharedProcessMetricsPollerByPid = memoize(getSharedProcessMetricsPollerByPid);
let getSharedProcessMetricsPollerByApp = (app, samplingInterval) => rxjs_1.Observable.timer(0, samplingInterval)
    .map(() => app.getAppMetrics())
    .map((metrics) => rxjs_1.Observable.fromPromise(exports.getMemoryMetrics(metrics)))
    .mergeAll()
    .share();
getSharedProcessMetricsPollerByApp = memoize(getSharedProcessMetricsPollerByApp);
/**
 * Returns an Observable that emits Electron.ProcessMetric[] on a regular interval.
 *
 * For a given `app` and a given `samplingInterval`, the returned observable is shared
 * for performance reasons.
 *
 * options.samplingInterval = 1000 (1s) by default
 * @param app
 * @param options
 */
exports.onProcessMetrics = (app, options) => {
    options = Object.assign({ samplingInterval: 1000 }, options);
    return getSharedProcessMetricsPollerByApp(app, options.samplingInterval);
};
/**
 * Returns an Rx.Observable that emits `PidUsage[]` every `options.samplingInterval` ms.
 *
 * For a given `pid` and a given `samplingInterval`, the returned observable is shared
 * for performance reasons.
 * `pid` is the root of the process tree.
 *
 * @param pid
 * @param {object} options
 * @param {number} options.samplingInterval - 1000 (1s) by default
 *
 * @example
 * - pid: main process
 *   - rendererPid1: renderer process
 *   - rendererPid2: renderer process
 */
exports.onProcessTreeMetricsForPid = (pid, options) => {
    options = Object.assign({ samplingInterval: 1000 }, options);
    return getSharedProcessMetricsPollerByPid(pid, options.samplingInterval);
};
exports.getMemoryMetrics = (appMetrics) => {
    const pids = appMetrics.map(proc => proc.pid);
    return pidusage(pids).then((pidInfo) => {
        return appMetrics.map(proc => {
            return Object.assign(Object.assign({}, proc), { pidusage: pidInfo[proc.pid] });
        });
    });
};
const getExtendedAppMetrics = (appMetrics) => {
    if (electron_1.webContents === undefined) {
        return appMetrics;
    }
    const allWebContents = electron_1.webContents.getAllWebContents();
    const webContentsInfo = allWebContents.map((wc) => ({
        type: wc.getType(),
        id: wc.id,
        pid: wc.getOSProcessId(),
        URL: wc.getURL(),
        URLDomain: extractURLDomain_1.default(wc.getURL()),
    }));
    return appMetrics.map(proc => {
        const report = proc;
        const wc = webContentsInfo.find(wc => wc.pid === proc.pid);
        if (!wc)
            return report;
        report.webContents = [wc];
        return report;
    });
};
/**
 * Returns an Rx.Observable that emits reports of `ExtendedProcessMetric`
 * every `options.samplingInterval` ms.
 *
 * Default `options.samplingInterval` = 1000ms
 *
 * Compared to `onProcessMetrics` it adds data on the `webContents` associated
 * to the given process.
 *
 * @param app the electron app instance
 * @param options
 */
exports.onExtendedProcessMetrics = (app, options = {}) => exports.onProcessMetrics(app, options).map(getExtendedAppMetrics);
/**
 * Will emit an array of `PidUsage` when a process of the tree exceeds the
 * `options.percentCPUUsageThreshold` on more than `options.samplesCount`
 * samples.
 * It monitors the whole tree of pids, starting from `childPid`.
 * The reason behind this is that the `process.pid` of the main process is at the same
 * level as all renderers.
 * So we fetch their common ancestor, which is the `ppid` of the main process.
 * The parent pid of `childPid` is not part of the end result
 * (that way, we monitor the same processes as `getAppMetrics`).
 *
 * In opposite to onExcessiveCPUUsage, onExcessiveCPUUsageInProcessTree does not use
 * Electron's internal measurement but rather use `pidusage`, a cross-platform
 * process cpu % and memory usage of a PID. It is known to have lower pressure on CPU.
 * Also, as this leverage `pidusage`, the measures on Windows can be considered
 * as not accurate.
 *
 * Default `options.samplesCount` = 10
 * Default `options.percentCPUUsageThreshold` = 80
 *
 * @param pid - the pid of the main process
 * @param options
 */
exports.onExcessiveCPUUsageInProcessTree = (pid, options) => {
    options = Object.assign({ samplesCount: 10, percentCPUUsageThreshold: 80 }, options);
    return exports.onProcessTreeMetricsForPid(pid, options)
        .map(appUsage => rxjs_1.Observable.from(appUsage))
        .mergeAll()
        .groupBy(appUsage => appUsage.pid)
        .map(g => g.bufferCount(options.samplesCount))
        .mergeAll()
        .filter(processMetricsSamples => {
        const excessiveSamplesCount = processMetricsSamples.filter(p => p.cpu >= options.percentCPUUsageThreshold).length;
        return excessiveSamplesCount === processMetricsSamples.length;
    });
};
/**
 * Will emit an array `ExtendedProcessMetric` when a process exceeds the
 * `options.percentCPUUsageThreshold` on more than `options.samplesCount`
 * samples.
 *
 * Default `options.samplesCount` = 10
 * Default `options.percentCPUUsageThreshold` = 80
 *
 * @param app the electron app instance
 * @param options
 */
exports.onExcessiveCPUUsage = (app, options) => {
    options = Object.assign({ samplesCount: 10, percentCPUUsageThreshold: 80 }, options);
    return exports.onExtendedProcessMetrics(app, options)
        .map(report => rxjs_1.Observable.from(report))
        .mergeAll()
        .groupBy(processMetric => processMetric.pid)
        .map(g => g.bufferCount(options.samplesCount))
        .mergeAll()
        .filter(processMetricsSamples => {
        const excessiveSamplesCount = processMetricsSamples.filter(p => p.cpu.percentCPUUsage >= options.percentCPUUsageThreshold).length;
        return excessiveSamplesCount == processMetricsSamples.length;
    });
};
//# sourceMappingURL=index.js.map