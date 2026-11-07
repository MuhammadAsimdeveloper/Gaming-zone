import {
  AlertTriangle,
  ArrowLeft,
  Backpack,
  Hammer,
  Play,
  Save,
  Skull,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { viewToInventory } from './craftUi';
import { itemIcon } from './itemIcon';
import { itemLabel } from './itemView';
import type { CraftDeathSummary, CraftInventoryItem } from './engine';
import { countItem } from './inventory';
import { itemSpec } from './items';
import {
  RECIPES,
  recipeStatus,
  recipesForStation,
  type CraftResult,
  type Recipe,
  type Station,
} from './recipes';
import type { CraftPreferences } from './settings';
import type { QualityTier } from './streaming';

export interface CraftInventoryView {
  slots: Array<CraftInventoryItem | null>;
  selected: number;
}

const STATION_LABEL: Record<Station, string> = {
  hand: 'Hand',
  workbench: 'Workbench',
  kiln: 'Kiln',
};

const STATIONS: Station[] = ['hand', 'workbench', 'kiln'];

function Glyph({ id, className }: { id: number; className?: string }) {
  const icon = itemIcon(id);
  if (!icon) return null;
  return (
    <img
      src={icon}
      alt=""
      draggable={false}
      className={`[image-rendering:pixelated] ${className ?? 'h-7 w-7'}`}
    />
  );
}

function OverlayShell({
  title,
  subtitle,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-night-950/80 p-3 backdrop-blur-sm">
      <div
        className={`my-auto w-full rounded-3xl border border-white/12 bg-night-900/95 p-5 shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function CraftInventoryPanel({
  view,
  onMove,
  onResume,
  onOpenCrafting,
}: {
  view: CraftInventoryView;
  onMove(from: number, to: number): void;
  onResume(): void;
  onOpenCrafting(): void;
}) {
  const [source, setSource] = useState<number | null>(null);

  function choose(index: number) {
    if (source === null) {
      if (view.slots[index]) setSource(index);
      return;
    }
    if (source === index) {
      setSource(null);
      return;
    }
    onMove(source, index);
    setSource(null);
  }

  function renderSlot(index: number, label: string) {
    const slot = view.slots[index];
    const selected = source === index;
    return (
      <button
        key={index}
        type="button"
        onClick={() => choose(index)}
        aria-pressed={selected}
        aria-label={
          slot
            ? `${label}: ${itemLabel(slot.id)} x${slot.count}${selected ? ', selected' : ''}`
            : `${label}: empty${selected ? ', selected' : ''}`
        }
        className={`relative grid aspect-square place-items-center rounded-lg border transition ${
          selected
            ? 'border-mint bg-mint/20'
            : 'border-white/10 bg-white/[0.04] hover:border-white/30'
        }`}
      >
        {slot ? <Glyph id={slot.id} className="h-8 w-8" /> : null}
        {slot && slot.count > 1 ? (
          <span className="absolute bottom-0.5 right-1 font-mono text-[10px] font-semibold text-white">
            {slot.count}
          </span>
        ) : null}
        {slot?.durability !== undefined ? (
          <span className="absolute inset-x-1 bottom-1 h-0.5 overflow-hidden rounded-full bg-black/50">
            <span
              className="block h-full rounded-full bg-mint"
              style={{
                width: `${Math.max(
                  4,
                  Math.min(100, (slot.durability / (itemSpec(slot.id)?.tool?.durability ?? 1)) * 100),
                )}%`,
              }}
            />
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <OverlayShell
      wide
      title="Inventory"
      subtitle={
        source === null
          ? 'Pick a stack, then pick a destination to move or swap it. Hotbar slots 1–9 are the bottom row.'
          : `Moving ${view.slots[source] ? itemLabel(view.slots[source]!.id) : 'stack'} — pick a destination.`
      }
    >
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Storage</p>
        <div className="mt-1.5 grid grid-cols-9 gap-1">
          {Array.from({ length: 27 }, (_, index) => renderSlot(index + 9, `Storage slot ${index + 1}`))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Hotbar</p>
        <div className="mt-1.5 grid grid-cols-9 gap-1">
          {Array.from({ length: 9 }, (_, index) => {
            const slot = renderSlot(index, `Hotbar slot ${index + 1}`);
            return (
              <div key={index} className="relative">
                {slot}
                {index === view.selected ? (
                  <span className="absolute -top-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-mint" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpenCrafting}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
        >
          <Hammer className="h-4 w-4" aria-hidden="true" /> Crafting
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to world
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted/60">
        {RECIPES.length} recipes · press E while playing to reopen this bag.
      </p>
    </OverlayShell>
  );
}

function statusLabel(status: ReturnType<typeof recipeStatus>, station: Station): string {
  if (status === 'craftable') return 'Ready';
  if (status === 'wrong-station') return `Needs ${STATION_LABEL[station]}`;
  return 'Missing items';
}

export function CraftCraftingPanel({
  station,
  view,
  onCraft,
  onResume,
  onOpenInventory,
}: {
  station: Station;
  view: CraftInventoryView;
  onCraft(recipeId: string): CraftResult;
  onResume(): void;
  onOpenInventory(): void;
}) {
  const [tab, setTab] = useState<Station>(station);
  const [message, setMessage] = useState<string | null>(null);
  const inventory = useMemo(() => viewToInventory(view), [view]);
  const recipes = useMemo(() => recipesForStation(tab), [tab]);

  function handleCraft(recipe: Recipe) {
    const result = onCraft(recipe.id);
    if (result.ok) {
      setMessage(`Crafted ${recipe.name}`);
      return;
    }
    if (result.reason === 'wrong-station') {
      setMessage(`Open a ${STATION_LABEL[recipe.station]} to craft ${recipe.name}.`);
    } else if (result.reason === 'no-room') {
      setMessage('Your inventory is full.');
    } else {
      setMessage(
        `Missing ${result.missing
          .map((entry) => `${entry.count} ${itemLabel(entry.id)}`)
          .join(', ')}.`,
      );
    }
  }

  return (
    <OverlayShell
      wide
      title="Crafting"
      subtitle={`Opened at the ${STATION_LABEL[station]}. Hand recipes work anywhere; workbench and kiln recipes need that station.`}
    >
      <div className="mt-4 flex gap-1 rounded-full border border-white/10 bg-night-950/70 p-1">
        {STATIONS.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setTab(entry)}
            aria-pressed={tab === entry}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === entry ? 'bg-white text-night-950' : 'text-muted hover:text-white'
            }`}
          >
            {STATION_LABEL[entry]}
          </button>
        ))}
      </div>

      {message ? (
        <p role="status" className="mt-2 rounded-xl border border-mint/25 bg-mint/10 px-3 py-1.5 text-[11px] text-mint">
          {message}
        </p>
      ) : null}

      <div className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
        {recipes.map((recipe) => {
          const status = recipeStatus(inventory, recipe, station);
          return (
            <div
              key={recipe.id}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2"
            >
              <Glyph id={recipe.output.id} className="h-8 w-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {recipe.name}
                  {recipe.output.count > 1 ? (
                    <span className="ml-1 font-mono text-[10px] font-normal text-muted">×{recipe.output.count}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted">
                  {recipe.ingredients
                    .map(
                      (entry) =>
                        `${countItem(inventory, entry.id)}/${entry.count} ${itemLabel(entry.id)}`,
                    )
                    .join(' · ')}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                  status === 'craftable'
                    ? 'bg-mint/15 text-mint'
                    : status === 'wrong-station'
                      ? 'bg-white/10 text-muted'
                      : 'bg-amber-400/15 text-amber-200'
                }`}
              >
                {statusLabel(status, recipe.station)}
              </span>
              <button
                type="button"
                onClick={() => handleCraft(recipe)}
                disabled={status !== 'craftable'}
                aria-label={`Craft ${recipe.name}`}
                className="h-8 shrink-0 rounded-full bg-mint px-3 text-[11px] font-semibold text-night-950 transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted/50"
              >
                Craft
              </button>
            </div>
          );
        })}
        </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpenInventory}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
        >
          <Backpack className="h-4 w-4" aria-hidden="true" /> Inventory
        </button>
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to world
        </button>
      </div>
    </OverlayShell>
  );
}

function SettingRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted/70">
        <span>{label}</span>
        <span className="font-mono normal-case text-ink">{value}</span>
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function CraftPausePanel({
  worldName,
  preferences,
  quality,
  muted,
  saveError,
  onResume,
  onSaveQuit,
  onChange,
  onToggleMute,
}: {
  worldName: string;
  preferences: CraftPreferences;
  quality: QualityTier;
  muted: boolean;
  saveError: string | null;
  onResume(): void;
  onSaveQuit(): void;
  onChange(patch: Partial<CraftPreferences>): void;
  onToggleMute(): void;
}) {
  const distanceRange = quality === 'mobile' ? { min: 2, max: 4 } : { min: 4, max: 8 };

  return (
    <OverlayShell
      title="World paused"
      subtitle={`${worldName} · the simulation, creatures and clock are frozen.`}
    >
      <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] bg-night-950/50 p-3">
        <SettingRow label="Render distance" value={`${preferences.renderDistance} chunks`}>
          <input
            type="range"
            min={distanceRange.min}
            max={distanceRange.max}
            step={1}
            value={preferences.renderDistance}
            onChange={(event) => onChange({ renderDistance: Number(event.target.value) })}
            className="w-full accent-mint"
            aria-label="Render distance"
          />
        </SettingRow>
        <SettingRow label="Field of view" value={`${preferences.fov}°`}>
          <input
            type="range"
            min={60}
            max={90}
            step={1}
            value={preferences.fov}
            onChange={(event) => onChange({ fov: Number(event.target.value) })}
            className="w-full accent-mint"
            aria-label="Field of view"
          />
        </SettingRow>
        <SettingRow label="Mouse sensitivity" value={preferences.sensitivity.toFixed(2)}>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.05}
            value={preferences.sensitivity}
            onChange={(event) => onChange({ sensitivity: Number(event.target.value) })}
            className="w-full accent-mint"
            aria-label="Mouse sensitivity"
          />
        </SettingRow>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] text-ink">
            <input
              type="checkbox"
              checked={preferences.shadows}
              onChange={(event) => onChange({ shadows: event.target.checked })}
              className="accent-mint"
            />
            Shadows
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] text-ink">
            <input
              type="checkbox"
              checked={preferences.reducedEffects}
              onChange={(event) => onChange({ reducedEffects: event.target.checked })}
              className="accent-mint"
            />
            Reduced effects
          </label>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] text-xs text-ink"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {muted ? 'Sound is muted' : 'Sound is on'}
        </button>
      </div>

      {saveError ? (
        <p role="alert" className="mt-2 rounded-xl border border-coral/30 bg-coral/10 p-2 text-[11px] text-coral">
          {saveError}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onResume}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Resume
        </button>
        <button
          type="button"
          onClick={onSaveQuit}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
        >
          <Save className="h-4 w-4" aria-hidden="true" /> Save and quit
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted/60">
        Desktop mouse look requires pointer lock. Press Esc at any time to release it and pause.
      </p>
    </OverlayShell>
  );
}

export function CraftDeathPanel({
  summary,
  onRespawn,
  onSaveQuit,
}: {
  summary: CraftDeathSummary;
  onRespawn(): void;
  onSaveQuit(): void;
}) {
  return (
    <OverlayShell title="You fell" subtitle="Your inventory is kept. Respawn at the world spawn point.">
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-coral/25 bg-coral/10 p-3">
        <Skull className="h-8 w-8 text-coral" aria-hidden="true" />
        <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex justify-between"><dt className="text-muted">Day</dt><dd className="text-white">{summary.day}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Deaths</dt><dd className="text-white">{summary.deaths}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Blocks mined</dt><dd className="text-white">{summary.blocksMined}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Blocks placed</dt><dd className="text-white">{summary.blocksPlaced}</dd></div>
          <div className="col-span-2 flex justify-between"><dt className="text-muted">Creatures defeated</dt><dd className="text-white">{summary.creaturesDefeated}</dd></div>
        </dl>
      </div>
      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onRespawn}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Respawn
        </button>
        <button
          type="button"
          onClick={onSaveQuit}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
        >
          <Save className="h-4 w-4" aria-hidden="true" /> Save and quit
        </button>
      </div>
    </OverlayShell>
  );
}

export function CraftLoadingScreen({ worldName, notice }: { worldName: string; notice: string | null }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-night-950/90 backdrop-blur-sm">
      <div role="status" aria-live="polite" className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-mint"
        />
        <p className="mt-4 font-display text-lg font-semibold text-white">{worldName}</p>
        <p className="mt-1 text-xs text-muted">Building terrain, lighting chunks and spawning creatures…</p>
        {notice ? (
          <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-2 text-[11px] text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}