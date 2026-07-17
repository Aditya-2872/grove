// ---------------------------------------------------------------------------
// AI settings: pick a provider (free Gemini or paid Claude), paste your own key,
// choose a model. The key lives only in this browser. With no key the app uses
// the smart offline mock; with a key it uses real AI.
// ---------------------------------------------------------------------------

import { useState } from "react";
import type { Provider } from "../ai";
import { loadSettings, saveSettings, PROVIDERS } from "../ai";
import { loadGlassAlpha, saveGlassAlpha, GLASS_MIN, GLASS_MAX } from "../prefs";
import { IconClose } from "./icons";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const initial = loadSettings();
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);

  // exit animation: keep the panel mounted through pop-out, then close
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  };

  // widget transparency (device-local); 0 = solid, 1 = most see-through
  const range = GLASS_MAX - GLASS_MIN;
  const [trans, setTrans] = useState(() => (GLASS_MAX - loadGlassAlpha()) / range);
  const onTrans = (t: number) => {
    setTrans(t);
    saveGlassAlpha(GLASS_MAX - t * range); // applies live to every .glass surface
  };

  const info = PROVIDERS[provider];

  const pickProvider = (p: Provider) => {
    setProvider(p);
    setModel(PROVIDERS[p].models[0].id); // reset model to that provider's default
  };

  const save = () => {
    saveSettings({ provider, apiKey: apiKey.trim(), model });
    requestClose();
  };
  const clear = () => {
    setApiKey("");
    saveSettings({ provider, apiKey: "", model });
  };

  const on = apiKey.trim().length > 0;

  return (
    <div className="fade-in fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ opacity: closing ? 0 : 1, transition: "opacity 0.2s ease" }}
        onClick={requestClose}
      />
      <div
        className={`glass ${closing ? "pop-out" : "pop-in"} relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl p-5`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-c">Settings</h2>
          <button onClick={requestClose} className="text-muted-c transition hover:text-c">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {/* appearance */}
        <span className="mb-1.5 block text-xs text-muted-c">Appearance</span>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-c">Widget transparency</span>
          <span className="text-[11px] text-muted-c tabular-nums">{Math.round(trans * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trans}
          onChange={(e) => onTrans(parseFloat(e.target.value))}
          className="w-full"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-c">
          Left is solid; right lets more of the scenery glow through the glass.
        </p>

        <div className="my-4 border-t hair" />

        {/* provider */}
        <span className="mb-1.5 block text-xs text-muted-c">Provider</span>
        <div className="mb-4 flex gap-2">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => pickProvider(p)}
              className={`hair flex-1 rounded-lg border px-3 py-2 text-left text-sm transition ${
                provider === p ? "text-c" : "text-muted-c hover:text-c"
              }`}
              style={provider === p ? { borderColor: "var(--accent)" } : undefined}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {PROVIDERS[p].label}
                {PROVIDERS[p].free && (
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] text-[#0a0d0b]" style={{ background: "var(--accent)" }}>
                    FREE
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* key */}
        <label className="mb-1 block text-xs text-muted-c">
          {info.label} API key <span className="opacity-70">— optional</span>
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={provider === "gemini" ? "AIza…" : "sk-ant-…"}
          className="surface-soft w-full rounded-lg px-3 py-2 text-sm text-c placeholder:text-muted-c outline-none"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-c">
          Grove's AI already works — you don't need a key. Add your own only if you'd rather use your own
          quota (or a different model); it's stored just in this browser and sent straight to the provider.
          Get one at{" "}
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="accent-text underline">
            {info.keyUrl.replace("https://", "")}
          </a>
          .
        </p>

        {/* model */}
        <div className="mt-4">
          <span className="mb-1.5 block text-xs text-muted-c">Model</span>
          <div className="flex gap-2">
            {info.models.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`hair flex-1 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  model === m.id ? "text-c" : "text-muted-c hover:text-c"
                }`}
                style={model === m.id ? { borderColor: "var(--accent)" } : undefined}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-[11px] text-muted-c">{m.note}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-muted-c">{on ? "Using your own key" : "Using Grove's AI"}</span>
          <div className="flex gap-2">
            {initial.apiKey && (
              <button
                onClick={clear}
                className="surface-soft rounded-lg px-3 py-1.5 text-sm text-muted-c transition hover:text-c"
              >
                Clear key
              </button>
            )}
            <button
              onClick={save}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-[#0a0d0b] transition hover:brightness-110"
              style={{ background: "var(--accent)" }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
