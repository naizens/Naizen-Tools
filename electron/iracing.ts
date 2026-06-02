import { EventEmitter } from 'events'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { IRacingSDK, CameraState } = require('irsdk-node')

const UI_HIDDEN_FLAG: number = CameraState?.UIHidden ?? 8

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function parseCameraStateBitmask(flags: string[]): number {
  let val = 0
  for (const f of flags) {
    if (typeof CameraState?.[f] === 'number') val |= CameraState[f] as number
  }
  return val
}

export interface IracingDriver {
  CarIdx: number
  UserName: string
  AbbrevName: string
  TeamName: string
  CarNumber: string
  CarScreenName: string
  CarScreenNameShort: string
  CarClass: string
  CarClassShortName: string
  IRating: number
}

export interface IracingSessionInfo {
  WeekendInfo?: {
    TrackDisplayName?: string
    TrackDisplayShortName?: string
    TrackName?: string
    TrackConfigName?: string
    TrackCity?: string
    TrackCountry?: string
    TrackType?: string
    TeamRacing?: number
  }
  DriverInfo?: {
    DriverCarIdx?: number
    Drivers?: IracingDriver[]
  }
  SessionInfo?: {
    Sessions?: Array<{ SessionType?: string; SessionName?: string }>
  }
}

export interface IracingTelemetry {
  CamCameraState: string[]
  CamCarIdx: number
  Lap: number
  SessionNum: number
}

export class IracingBridge extends EventEmitter {
  private sdk: any = null
  private _connected = false
  private _active = false

  sessionInfo: IracingSessionInfo = {}
  telemetry: IracingTelemetry = { CamCameraState: [], CamCarIdx: 0, Lap: 0, SessionNum: 0 }

  get connected() { return this._connected }

  async start() {
    this.sdk = new IRacingSDK()
    this._active = true

    while (this._active) {
      const isRunning: boolean = await IRacingSDK.IsSimRunning().catch(() => false)

      if (!isRunning) {
        if (this._connected) {
          this._connected = false
          try { this.sdk.stopSDK() } catch { /* ignore */ }
          this.emit('disconnected')
        }
        await delay(1000)
        continue
      }

      if (!this._connected) {
        this.sdk.startSDK()
        this._connected = true
        this.emit('connected')
      }

      if (this.sdk.waitForData(16)) {
        const raw = this.sdk.getSessionData()
        const telem = this.sdk.getTelemetry()

        this.sessionInfo = raw?.data ?? raw ?? {}
        this.telemetry = {
          CamCameraState: telem?.values?.CamCameraState ?? [],
          CamCarIdx:      telem?.values?.CamCarIdx ?? 0,
          Lap:            telem?.values?.Lap ?? 0,
          SessionNum:     telem?.values?.SessionNum ?? 0,
        }
        this.emit('update')
      }

      await delay(16)
    }
  }

  stop() {
    this._active = false
    if (this._connected && this.sdk) {
      try { this.sdk.stopSDK() } catch { /* ignore */ }
      this._connected = false
    }
  }

  hideUI(): number {
    const current = parseCameraStateBitmask(this.telemetry.CamCameraState)
    try { this.sdk?.changeCameraState(current | UI_HIDDEN_FLAG) } catch { /* ignore */ }
    return current
  }

  restoreUI(original: number) {
    try { this.sdk?.changeCameraState(original) } catch { /* ignore */ }
  }

  async waitForUIHidden(timeoutMs = 500): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (this.telemetry.CamCameraState.includes('UIHidden')) return
      await delay(16)
    }
  }
}
