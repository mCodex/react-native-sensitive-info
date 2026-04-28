type Listener = (status: string) => void

const listeners: Listener[] = []

export const AppState = {
	currentState: 'active' as string,
	addEventListener: (event: 'change', listener: Listener) => {
		if (event !== 'change') {
			throw new Error(`unsupported AppState event: ${event}`)
		}
		listeners.push(listener)
		return {
			remove: () => {
				const idx = listeners.indexOf(listener)
				if (idx >= 0) listeners.splice(idx, 1)
			},
		}
	},
	__emit: (status: string) => {
		AppState.currentState = status
		for (const l of [...listeners]) l(status)
	},
	__listenerCount: () => listeners.length,
	__reset: () => {
		listeners.length = 0
		AppState.currentState = 'active'
	},
}

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown'

export const NativeModules = {}

export default {
	AppState,
	NativeModules,
}
