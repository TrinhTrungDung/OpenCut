import { useEffect, useRef } from "react";

export function useRafLoop(callback: ({ time }: { time: number }) => void) {
	const requestRef = useRef<number>(0);
	const previousTimeRef = useRef<number | null>(null);
	const callbackRef = useRef(callback);

	// Always keep ref current — avoids restarting the RAF loop on callback change
	callbackRef.current = callback;

	useEffect(() => {
		const loop = ({ time }: { time: number }) => {
			if (previousTimeRef.current !== null) {
				const deltaTime = time - previousTimeRef.current;
				callbackRef.current({ time: deltaTime });
			}
			previousTimeRef.current = time;
			requestRef.current = requestAnimationFrame((time) => loop({ time }));
		};

		requestRef.current = requestAnimationFrame((time) => loop({ time }));
		return () => cancelAnimationFrame(requestRef.current);
	}, []);
}
