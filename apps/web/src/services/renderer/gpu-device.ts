/**
 * Singleton GPUDevice initialization with feature detection.
 * Provides sync access for render-time use after async init at startup.
 */

let gpuDevice: GPUDevice | null = null;
let gpuInitialized = false;

/**
 * Initialize the GPU device. Call once at app startup (fire-and-forget).
 * Returns the device if WebGPU is available, null otherwise.
 */
export async function initGPUDevice(): Promise<GPUDevice | null> {
	if (gpuInitialized) return gpuDevice;
	gpuInitialized = true;

	if (typeof navigator === "undefined" || !navigator.gpu) {
		return null;
	}

	try {
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) return null;

		gpuDevice = await adapter.requestDevice();

		// Handle device loss — fall back to WebGL1 for remainder of session
		gpuDevice.lost.then((info) => {
			console.warn(`[gpu-device] GPUDevice lost: ${info.reason}`, info.message);
			gpuDevice = null;
		});

		return gpuDevice;
	} catch (err) {
		console.warn("[gpu-device] WebGPU init failed, using WebGL1 fallback:", err);
		return null;
	}
}

/**
 * Synchronous getter for render-time use. Returns null if WebGPU
 * is unavailable or not yet initialized.
 */
export function getGPUDeviceSync(): GPUDevice | null {
	return gpuDevice;
}
