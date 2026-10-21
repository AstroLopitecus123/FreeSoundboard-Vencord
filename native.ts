import { app, desktopCapturer, session } from "electron";
import os from "os";
import { RendererSettings } from "@main/settings";

let currentTargetSourceId: string | undefined;

export async function setTargetSourceId(_: any, id: string) {
    currentTargetSourceId = id;
    console.log("[FreeSoundboard:Native] Target source ID set to:", id);
    return true;
}

function getLoopbackAudioMode(): string {
    if (process.platform !== "win32") return "loopback";
    try {
        const parts = os.release().split(".");
        const build = parseInt(parts[2] || "0", 10);
        if (build >= 19045) {
            return "loopbackWithoutChrome";
        }
    } catch {}
    return "loopback";
}

function registerDisplayMediaHandler() {
    if (!session.defaultSession) return;

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        let hasResponded = false;
        const safeCallback = (response: any) => {
            if (hasResponded) return;
            hasResponded = true;
            try {
                callback(response);
            } catch (e) {
                console.error("[FreeSoundboard:Native] Callback error:", e);
            }
        };

        try {
            const isPluginEnabled = RendererSettings.store?.plugins?.FreeSoundboard?.enabled !== false;
            if (!isPluginEnabled) {
                console.log("[FreeSoundboard:Native] Plugin disabled, ignoring request");
                safeCallback({});
                return;
            }

            console.log("[FreeSoundboard:Native] setDisplayMediaRequest received:", {
                videoRequested: request.videoRequested,
                audioRequested: request.audioRequested
            });

            const sources = await desktopCapturer.getSources({
                types: ["screen", "window"],
                thumbnailSize: { width: 0, height: 0 },
                fetchWindowIcons: false
            });
            console.log("[FreeSoundboard:Native] Sources count:", sources?.length ?? 0);

            if (!sources || sources.length === 0) {
                console.log("[FreeSoundboard:Native] No sources available");
                safeCallback({});
                return;
            }

            let targetId = currentTargetSourceId;
            if (!targetId && request.frame) {
                try {
                    targetId = (await request.frame.executeJavaScript("window.__selectedDesktopSourceId")) as string | undefined;
                } catch {}
            }

            let chosenSource: Electron.DesktopCapturerSource | undefined;
            if (targetId) {
                chosenSource = sources.find(s => s.id === targetId);
                if (!chosenSource) {
                    const parts = targetId.split(":");
                    if (parts.length >= 2) {
                        const targetType = parts[0];
                        const targetHandle = parts[1];
                        chosenSource = sources.find(s => {
                            const sParts = s.id.split(":");
                            return sParts[0] === targetType && sParts[1] === targetHandle;
                        });
                    }
                }
            }

            if (!chosenSource) {
                chosenSource = sources.find(s => s.id.startsWith("screen:")) ?? sources[0];
            }

            console.log("[FreeSoundboard:Native] Target source ID:", targetId, "Matched:", chosenSource?.id, chosenSource?.name);

            const streams: any = {};

            if (request.videoRequested && chosenSource) {
                streams.video = chosenSource;
            }

            if (request.audioRequested) {
                const isWindow = chosenSource?.id?.startsWith("window:") ?? false;
                const audioMode = isWindow ? "loopback" : getLoopbackAudioMode();
                console.log("[FreeSoundboard:Native] Audio requested, using mode:", audioMode, "for source:", chosenSource?.id);
                streams.audio = audioMode;
            } else {
                console.log("[FreeSoundboard:Native] Audio not requested by caller");
            }

            safeCallback(streams);
        } catch (e) {
            console.error("[FreeSoundboard:Native] Handler error:", e);
            safeCallback({});
        }
    });
}

if (app.isReady()) {
    registerDisplayMediaHandler();
} else {
    app.whenReady().then(registerDisplayMediaHandler);
}

export async function ping() {
    return true;
}
