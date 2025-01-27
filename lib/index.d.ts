/// <reference types="electron" />
import { Observable } from 'rxjs';
export interface onProcessMetricsOptions {
    /** in ms */
    samplingInterval?: number;
}
export interface PidUsage {
    cpu: number;
    memory: number;
    pid: number;
    ppid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
}
export declare const getPidUsage: (pid: number) => Promise<PidUsage[]>;
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
export declare const onProcessMetrics: (app: Electron.App, options: onProcessMetricsOptions) => Observable<Electron.ProcessMetric[]>;
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
export declare const onProcessTreeMetricsForPid: (pid: number, options: onProcessMetricsOptions) => Observable<PidUsage[]>;
export interface ExtendedProcessMetric extends Electron.ProcessMetric {
    webContents?: {
        type: string;
        id: number;
        pid: number;
        URL: string;
        URLDomain: string;
    }[];
}
export declare const getMemoryMetrics: (appMetrics: Electron.ProcessMetric[]) => Promise<[]>;
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
export declare const onExtendedProcessMetrics: (app: Electron.App, options?: onProcessMetricsOptions) => Observable<Electron.ProcessMetric[]>;
export interface onExcessiveCPUUsageOptions extends onProcessMetricsOptions {
    /**Number of samples to consider */
    samplesCount?: number;
    /**CPU usage percent minimum to consider a sample exceeds CPU usage */
    percentCPUUsageThreshold?: number;
}
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
export declare const onExcessiveCPUUsageInProcessTree: (pid: number, options: onExcessiveCPUUsageOptions) => Observable<PidUsage[]>;
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
export declare const onExcessiveCPUUsage: (app: Electron.App, options: onExcessiveCPUUsageOptions) => Observable<Electron.ProcessMetric[]>;
