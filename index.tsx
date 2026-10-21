import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Menu, PermissionStore, PermissionsBits, UserStore } from "@webpack/common";
import { EventEmitter } from "events";

interface AudioInput extends EventEmitter {
    stream?: MediaStream;
    context: AudioContext;
    _mute: boolean;
    speaking: boolean;
    setSpeaking(value: boolean): void;
    updateAudioTracks(): void;
}

interface SoundEvent {
    type: "SOUNDBOARD_SOUNDS_RECEIVED" | "GUILD_SOUNDBOARD_SOUND_CREATE" | "GUILD_SOUNDBOARD_SOUND_UPDATE" | "GUILD_SOUNDBOARD_SOUNDS_UPDATE" | "VOICE_CHANNEL_SELECT" | "AUDIO_TOGGLE_SELF_DEAF";
    updates?: {
        guildId: string;
        sounds: Sound[];
    }[];
    sound?: Sound;
    sounds?: Sound[];
    guildId?: string;
    channelId?: string | null;
}

interface Sound {
    soundId: string;
    guildId: string;
    name: string;
    volume?: number;
    available?: boolean;
    emojiId?: string;
    emojiName?: string;
}

interface PlayingSoundEntry {
    audio: HTMLAudioElement;
    node: MediaElementAudioSourceNode;
    gain: GainNode;
    timeout?: any;
}

interface InputState {
    input: AudioInput;
    originalStream: MediaStream;
    source: MediaStreamAudioSourceNode;
    micGain: GainNode;
    dest: MediaStreamAudioDestinationNode;
    playing: Map<string, PlayingSoundEntry>;
}

const inputs = new Map<MediaStream, InputState>();

let originalGetDisplayMedia: any = null;

async function getDesktopStream(options?: DisplayMediaStreamOptions): Promise<MediaStream> {
    const id = (window as any).__selectedDesktopSourceId;
    console.log("[FreeSoundboard] getDesktopStream invoked for target source ID:", id);

    if (id && navigator?.mediaDevices?.getUserMedia) {
        // Try audio + video first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: "desktop"
                    }
                } as any,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: id,
                        maxWidth: 3840,
                        maxHeight: 2160,
                        maxFrameRate: 60
                    }
                } as any
            });
            console.log("[FreeSoundboard] Captured desktop stream WITH audio for source:", id);
            return stream;
        } catch (audioErr) {
            console.warn("[FreeSoundboard] Audio capture failed with source:", id, "falling back to video-only:", audioErr);
        }

        // Fallback: video only (guaranteed no freeze/black screen from WASAPI audio errors)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: id,
                        maxWidth: 3840,
                        maxHeight: 2160,
                        maxFrameRate: 60
                    }
                } as any
            });
            console.log("[FreeSoundboard] Captured video-only desktop stream for source:", id);
            return stream;
        } catch (videoErr) {
            console.error("[FreeSoundboard] Video capture with chromeMediaSource failed:", videoErr);
        }
    }

    if (originalGetDisplayMedia) {
        console.log("[FreeSoundboard] Falling back to original getDisplayMedia");
        return originalGetDisplayMedia(options);
    }

    throw new Error("[FreeSoundboard] Unable to acquire desktop stream");
}

function getVoiceGain(isMute: boolean): number {
    if (isMute) return 0;
    const boost = settings.store?.voiceVolume ?? 200;
    return Math.max(0, boost / 100);
}

function updateAllVoiceGains() {
    for (const state of inputs.values()) {
        state.micGain.gain.value = getVoiceGain(state.input._mute);
    }
}

const settings = definePluginSettings({
    bypassMode: {
        type: OptionType.SELECT,
        description: "Cuándo usar el bypass de audio para el panel de sonidos",
        options: [
            {
                label: "Automático (Otros servidores sin Nitro / Sin permisos)",
                value: "smart",
                default: true
            },
            {
                label: "Siempre (Todos los sonidos del Soundboard)",
                value: "always"
            }
        ]
    },
    voiceVolume: {
        type: OptionType.SLIDER,
        description: "Volumen / Ganancia de la propia voz en la llamada (%)",
        default: 200,
        markers: [100, 125, 150, 175, 200, 250, 300],
        stickToMarkers: false,
        onChange: () => updateAllVoiceGains()
    },
    transmitVolume: {
        type: OptionType.SLIDER,
        description: "Volumen de transmisión de los sonidos hacia la llamada (%)",
        default: 100,
        markers: [25, 50, 75, 100, 125, 150, 200],
        stickToMarkers: false
    }
});

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user: any }) => {
    if (!user) return;
    const isSelf = user.id === UserStore.getCurrentUser()?.id;
    if (!isSelf) return;

    children.push(
        <Menu.MenuSeparator key="sb-bypass-sep" />,
        <Menu.MenuGroup key="sb-bypass-group" label="Sonidos y Micrófono">
            <Menu.MenuControlItem
                id="sb-bypass-voice-volume"
                key="sb-bypass-voice-item"
                label="Volumen de voz (Micrófono)"
                control={(props: any, ref: any) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={50}
                        maxValue={300}
                        value={settings.store.voiceVolume ?? 200}
                        onChange={(val: number) => {
                            settings.store.voiceVolume = Math.round(val);
                            updateAllVoiceGains();
                        }}
                        renderValue={(val: number) => `${Math.round(val)}%`}
                    />
                )}
            />
            <Menu.MenuControlItem
                id="sb-bypass-sounds-volume"
                key="sb-bypass-sounds-item"
                label="Volumen de sonidos (Soundboard)"
                control={(props: any, ref: any) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0}
                        maxValue={200}
                        value={settings.store.transmitVolume ?? 100}
                        onChange={(val: number) => {
                            settings.store.transmitVolume = Math.round(val);
                        }}
                        renderValue={(val: number) => `${Math.round(val)}%`}
                    />
                )}
            />
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "FreeSoundboard",
    description: "Permite usar sonidos del panel de sonidos de cualquier servidor en llamadas de voz sin Nitro ni cables virtuales en Discord de Escritorio y Web. Edit y adaptación basada en el plugin de YashRajCodes.",
    authors: [{ name: "astrogato14", id: 723238317595951155n }],
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch
    },

    patches: [
        {
            find: '"cameraBackgroundPreview"',
            replacement: {
                match: /\[\i\.\i\.NATIVE,(\i\.\i\.WEBRTC)\]/,
                replace: "[$1]"
            }
        },
        {
            find: '"OculusBrowser"',
            replacement: {
                match: /"Chrome"===(\i\(\)\.name)/g,
                replace: '("Chrome"===$1||"Electron"===$1)'
            }
        },
        {
            find: '"MediaEngineStore"',
            replacement: {
                match: /\(0,\i\.isWeb\)\(\)(?=\}|\&\&\i\.(?:fetchAsyncResources|startDavePreload))/g,
                replace: "!0"
            }
        },
        {
            find: "shouldSendSpeaking",
            replacement: {
                match: /shouldSendSpeaking\((\i),(\i)\)\{if\(\(0,\i\.isWeb\)\(\)\)return!0;/,
                replace: "shouldSendSpeaking($1,$2){return!0;"
            }
        },
        {
            find: 'type:"GUILD_SOUNDBOARD_SOUND_CREATE"',
            replacement: {
                match: /(?<=type:"(?:SOUNDBOARD_SOUNDS_RECEIVED|GUILD_SOUNDBOARD_SOUND_CREATE|GUILD_SOUNDBOARD_SOUND_UPDATE|GUILD_SOUNDBOARD_SOUNDS_UPDATE)".{0,200}?available:)\i\.available/g,
                replace: "true"
            }
        },
        {
            find: "canUseSoundboardEverywhere:",
            replacement: {
                match: /(?<=canUseSoundboardEverywhere:function\(\i\)\{)/,
                replace: "return true;"
            }
        },
        {
            find: 'location:"useSoundGrid"',
            replacement: {
                match: /isNitroLocked:!\i/,
                replace: "isNitroLocked:false"
            }
        },
        {
            find: /getFlattenedGuildIds\(\).{0,100}USE_EXTERNAL_SOUNDS.{0,100}canUseSoundboardEverywhere/,
            replacement: {
                match: /\i\.\i\.can\(\i\.\i\.USE_EXTERNAL_SOUNDS,\i\)/,
                replace: "true"
            }
        },
        {
            find: /CALLABLE\.has\(.{0,100}USE_SOUNDBOARD/,
            replacement: {
                match: /(?<=return \i\.isGuildVoiceOrThread\(\))&&\i&&(\i)/,
                replace: "&&$1"
            }
        },
        {
            find: ".SEND_SOUNDBOARD_SOUND(",
            replacement: [
                {
                    match: /function \i\((\i),(\i),\i,\i\)\{\(0,\i\.\i\)\(\2,\1\),/,
                    replace: "$&$self.shouldBypass($1,$2)?$self.playSound($1):"
                },
                {
                    match: /\(\i\.Ay\.canUseSoundboardEverywhere\(\i\)\|\|\i\.guildId===\i\?\.guild_id\|\|"0"===\i\.guildId\)/,
                    replace: "!0"
                },
                {
                    match: /\i\.A\.can\(\i\.xBc\.USE_EXTERNAL_SOUNDS,\i\)/,
                    replace: "!0"
                }
            ]
        },
        {
            find: "AudioInput: No MediaStream",
            replacement: [
                {
                    match: /(?<=}else this\.stream=\i;)return this\.updateMode\(\)/,
                    replace: "this.stream=$self.mixInput(this,this.stream);return this.updateMode()"
                },
                {
                    match: /release\((\i)\)\{\1\.getTracks\(\)/,
                    replace: "release($1){$self.releaseInput($1);$1.getTracks()"
                },
                {
                    match: /(?<=\.enabled=)!this\._mute/,
                    replace: "$self.shouldEnableInput(this)"
                },
                {
                    match: /set mute\((\i)\)\{this\._mute=\1,this\.updateAudioTracks\(\),this\.setSpeaking\(!1\)/,
                    replace: "set mute($1){this._mute=$1,this.updateAudioTracks(),this.setSpeaking($self.isInputPlaying(this))"
                },
                {
                    match: /this\.enabled&&(\i\.input\.enableAudioInput\(\))/,
                    replace: "(this.enabled?$1:this.enable())"
                },
                {
                    match: /case \i\.\i\.VOICE_PROCESSING:return"Chrome"===(\i\(\)\.name)/,
                    replace: '$&||"Electron"===$1'
                }
            ]
        },
        {
            find: "this.desktopInputPool.get(",
            replacement: {
                match: /let (\i)=!1,(\i)=this\.desktopInputPool\.get\((\i)\.desktopDescription\.id\);if\(null==\2\)return;/,
                replace: 'let $1=!1,$2=this.desktopInputPool.get($3.desktopDescription.id);if(null==$2||$2.stream?.getVideoTracks()[0]?.readyState==="ended"){if($2){try{$2.destroy()}catch(e){}}window.__selectedDesktopSourceId=$3.desktopDescription.id;try{window.VencordNative?.pluginHelpers?.FreeSoundboard?.setTargetSourceId?.($3.desktopDescription.id)}catch(e){}console.log("[FreeSoundboard] Acquiring desktop stream for source:",$3.desktopDescription.id);this.desktopInputPool.acquire({},!0).then(inp=>{console.log("[FreeSoundboard] Stream acquired successfully, connecting to stream context");inp.id=$3.desktopDescription.id;this.desktopInputPool.pool[$3.desktopDescription.id]=inp;let c=!1;this.eachConnection(e=>{e.streamUserId===e.userId&&(c=!0,e.setDesktopInput(inp))},t);c||this.desktopInputPool.release(inp)}).catch(e=>console.error("[FreeSoundboard] acquire stream error:",e));return;}'
            }
        }
    ],

    start() {
        if (navigator?.mediaDevices) {
            originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
            navigator.mediaDevices.getDisplayMedia = (options?: DisplayMediaStreamOptions) => {
                return getDesktopStream(options);
            };
            console.log("[FreeSoundboard] Custom getDisplayMedia hooked successfully");
        }
    },

    flux: {
        SOUNDBOARD_SOUNDS_RECEIVED: (event: SoundEvent) => {
            event.updates?.forEach(u => u.sounds?.forEach(s => { s.available = true; }));
        },
        GUILD_SOUNDBOARD_SOUND_CREATE: (event: SoundEvent) => {
            if (event.sound) event.sound.available = true;
        },
        GUILD_SOUNDBOARD_SOUND_UPDATE: (event: SoundEvent) => {
            if (event.sound) event.sound.available = true;
        },
        GUILD_SOUNDBOARD_SOUNDS_UPDATE: (event: SoundEvent) => {
            event.sounds?.forEach(s => { s.available = true; });
        },
        VOICE_CHANNEL_SELECT: (event: SoundEvent) => {
            if (!event.channelId) {
                for (const state of inputs.values()) {
                    stopAllForState(state);
                }
            }
        }
    },

    shouldBypass(sound: Sound, channelId: string): boolean {
        if (settings.store.bypassMode === "always") return true;

        const channel = ChannelStore.getChannel(channelId);
        if (!channel) return true;

        const isDefaultOrSameGuild = sound.guildId === "0" || sound.guildId === channel.guild_id;
        const currentUser = UserStore.getCurrentUser();
        const hasRealNitro = currentUser?.premiumType === 2;

        if (!isDefaultOrSameGuild && !hasRealNitro) return true;

        if (channel.guild_id) {
            if (!PermissionStore.can(PermissionsBits.USE_SOUNDBOARD, channel)) return true;
            if (!isDefaultOrSameGuild && !PermissionStore.can(PermissionsBits.USE_EXTERNAL_SOUNDS, channel)) return true;
        }

        if (sound.available === false) return true;

        return false;
    },

    mixInput(input: AudioInput, stream: MediaStream): MediaStream {
        if (input.context.state === "suspended") {
            input.context.resume().catch(() => {});
        }

        const source = input.context.createMediaStreamSource(stream);
        const micGain = input.context.createGain();
        micGain.gain.value = getVoiceGain(input._mute);

        const dest = input.context.createMediaStreamDestination();
        source.connect(micGain);
        micGain.connect(dest);

        const state: InputState = {
            input,
            originalStream: stream,
            source,
            micGain,
            dest,
            playing: new Map()
        };

        inputs.set(dest.stream, state);
        return dest.stream;
    },

    releaseInput(stream: MediaStream) {
        const state = inputs.get(stream);
        if (!state) return;

        stopAllForState(state);
        try {
            state.source.disconnect();
            state.micGain.disconnect();
            state.dest.disconnect();
        } catch {}

        state.originalStream.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
        });

        inputs.delete(stream);
    },

    shouldEnableInput(input: AudioInput): boolean {
        const state = input.stream ? inputs.get(input.stream) : undefined;
        if (state) {
            state.micGain.gain.value = getVoiceGain(input._mute);
        }
        return !input._mute || this.isInputPlaying(input);
    },

    isInputPlaying(input: AudioInput): boolean {
        if (!input.stream) return false;
        const state = inputs.get(input.stream);
        return Boolean(state && state.playing.size > 0);
    },

    playSound(sound: Sound) {
        const url = `https://cdn.discordapp.com/soundboard-sounds/${sound.soundId}`;
        const volumeMultiplier = (settings.store.transmitVolume ?? 100) / 100;
        const baseVol = typeof sound.volume === "number" && !isNaN(sound.volume) ? sound.volume : 1;
        const targetGain = Math.max(0, Math.min(2, baseVol * volumeMultiplier));

        for (const state of inputs.values()) {
            const existing = state.playing.get(sound.soundId);
            if (existing) {
                cleanupEntry(state, sound.soundId, existing);
            }

            const audio = new Audio(url);
            audio.crossOrigin = "anonymous";

            const node = state.input.context.createMediaElementSource(audio);
            const gain = state.input.context.createGain();
            gain.gain.value = targetGain;

            node.connect(gain);
            gain.connect(state.dest);

            const entry: PlayingSoundEntry = { audio, node, gain };
            state.playing.set(sound.soundId, entry);

            if (state.input.context.state === "suspended") {
                state.input.context.resume().catch(() => {});
            }

            state.input.updateAudioTracks();
            state.input.setSpeaking(true);

            const onFinish = () => {
                cleanupEntry(state, sound.soundId, entry);
            };

            entry.timeout = setTimeout(onFinish, 15000);

            audio.addEventListener("ended", onFinish, { once: true });
            audio.addEventListener("error", onFinish, { once: true });

            audio.play().catch(() => {
                onFinish();
            });
        }
    },

    stop() {
        if (navigator?.mediaDevices && originalGetDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
            originalGetDisplayMedia = null;
            console.log("[FreeSoundboard] Custom getDisplayMedia unhooked");
        }
        for (const state of inputs.values()) {
            stopAllForState(state);
            try {
                state.source.disconnect();
                state.micGain.disconnect();
                state.dest.disconnect();
            } catch {}
        }
        inputs.clear();
    }
});

function cleanupEntry(state: InputState, soundId: string, entry: PlayingSoundEntry) {
    if (state.playing.get(soundId) !== entry) return;
    state.playing.delete(soundId);

    if (entry.timeout) {
        clearTimeout(entry.timeout);
        entry.timeout = undefined;
    }

    try {
        entry.audio.pause();
        entry.audio.src = "";
        entry.node.disconnect();
        entry.gain.disconnect();
    } catch {}

    state.input.updateAudioTracks();
    if (state.playing.size === 0) {
        state.input.setSpeaking(false);
    }
}

function stopAllForState(state: InputState) {
    for (const [soundId, entry] of Array.from(state.playing.entries())) {
        cleanupEntry(state, soundId, entry);
    }
}
