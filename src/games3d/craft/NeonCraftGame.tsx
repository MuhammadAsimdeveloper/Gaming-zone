import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVisibilityPause } from '../../games/shared/useVisibilityPause';
import type { GameComponentProps } from '../../types/game';
import { WebGLContextNotice } from '../shared/WebGLContextNotice';
import { readMutedPreference, writeMutedPreference } from '../shared/mutePreference';
import { useWebGLContextLoss } from '../shared/useContextLoss';
import { CraftHudView } from './CraftHud';
import {
  CraftCraftingPanel,
  CraftDeathPanel,
  CraftInventoryPanel,
  CraftLoadingScreen,
  CraftPausePanel,
  type CraftInventoryView,
} from './CraftPanels';
import { CraftTouchControls } from './CraftTouchControls';
import { CraftWorldSelect } from './CraftWorldSelect';
import { detectTouch, randomSeed } from './craftUi';
import {
  CraftEngine,
  type CraftDeathSummary,
  type CraftHud,
  type CraftQuality,
} from './engine';
import type { Station } from './recipes';
import { createSave, type SaveRecord, type SaveSlot } from './save';
import {
  createSaveStore,
  indexedDbAvailable,
  type SaveStore,
  type SlotSummary,
} from './saveStore';
import {
  loadPreferences,
  savePreferences,
  sanitizePreferences,
  type CraftPreferences,
} from './settings';
import { createTerrain, findSpawn } from './terrain';

type Phase = 'menu' | 'loading' | 'play' | 'inventory' | 'crafting' | 'paused' | 'dead';

const EMPTY_VIEW: CraftInventoryView = {
  slots: Array.from({ length: 36 }, () => null),
  selected: 0,
};

const START_HUD: CraftHud = {
  health: 20,
  hunger: 20,
  clock: '06:00',
  day: 1,
  phase: 'day',
  hotbar: Array.from({ length: 9 }, () => null),
  selected: 0,
  prompt: null,
  toast: null,
  mining: 0,
  underwater: false,
  depth: 64,
};

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export default function NeonCraftGame({ onStart }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CraftEngine | null>(null);
  const storeRef = useRef<SaveStore | null>(null);
  const touch = useMemo(detectTouch, []);
  const quality: CraftQuality = touch ? 'mobile' : 'desktop';

  const [phase, setPhase] = useState<Phase>('menu');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const [pending, setPending] = useState<SaveRecord | null>(null);
  const [slots, setSlots] = useState<SlotSummary[] | null>(null);
  const [savingAvailable] = useState(() => indexedDbAvailable());
  const [slotError, setSlotError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [hud, setHud] = useState<CraftHud>(START_HUD);
  const [inventory, setInventory] = useState<CraftInventoryView>(EMPTY_VIEW);
  const [craftingStation, setCraftingStation] = useState<Station>('hand');
  const [death, setDeath] = useState<CraftDeathSummary | null>(null);
  const [worldName, setWorldName] = useState('New world');
  const [preferences, setPreferences] = useState<CraftPreferences>(() => loadPreferences(quality));
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [muted, setMuted] = useState(readMutedPreference);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [saveError, setSaveError] = useState<string | null>(null);
  const contextLost = useWebGLContextLoss(canvasRef);

  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const refreshSlots = useCallback(async () => {
    const store = storeRef.current;
    if (!store) {
      setSlots([]);
      return;
    }
    try {
      setSlots(await store.list());
      setSlotError(null);
    } catch (cause) {
      setSlotError(`The save slots could not be read: ${messageOf(cause, 'unknown error')}`);
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    if (!savingAvailable) {
      setSlots([]);
      return;
    }
    try {
      storeRef.current = createSaveStore(indexedDB);
      void refreshSlots();
    } catch (cause) {
      setSlotError(`Saving is unavailable: ${messageOf(cause, 'IndexedDB failed to open')}`);
      setSlots([]);
    }
    return () => {
      storeRef.current = null;
    };
  }, [refreshSlots, savingAvailable]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'loading' || !pending) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const engine = new CraftEngine(
          canvas,
          {
            record: pending,
            settings: preferencesRef.current,
            quality,
            touch,
            muted: mutedRef.current,
          },
          {
            onHud: setHud,
            onInventory: setInventory,
            onOpenCrafting: (station) => {
              setCraftingStation(station);
              setPhase('crafting');
            },
            onOpenInventory: () => setPhase('inventory'),
            onPauseRequest: () => setPhase('paused'),
            onDeath: (summary) => {
              setDeath(summary);
              setPhase('dead');
            },
            onAutosave: (record) => {
              const store = storeRef.current;
              if (!store) return;
              void store
                .write(record)
                .catch((cause: unknown) =>
                  setSaveError(`Autosave failed: ${messageOf(cause, 'unknown error')}`),
                );
            },
            onLockChange: (locked) => {
              if (locked && !engine.isPaused) setPhase('play');
            },
          },
        );
        engineRef.current = engine;
        setWorldName(pending.name);
        setDeath(null);
        setSaveError(null);
        engine.start();
        onStartRef.current?.();
        if (touch) {
          engine.resume();
          setPhase('play');
        } else {
          engine.pause();
          setPhase('paused');
        }
      } catch (cause) {
        setFatal(
          `Neon Craft needs WebGL. The renderer could not start: ${messageOf(
            cause,
            'try enabling hardware acceleration or another browser',
          )}`,
        );
        setPending(null);
        setPhase('menu');
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [phase, pending, quality, touch]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (contextLost) engine.pause();
    else if (phaseRef.current === 'play') engine.resume();
  }, [contextLost]);

  const resume = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resume();
    setPhase('play');
    if (!touch) engine.requestPointerLock();
  }, [touch]);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setPhase('paused');
  }, []);

  const openInventory = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.pause();
    setPhase('inventory');
  }, []);

  const pauseForVisibility = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.isPaused) return;
    engine.pause();
    setPhase('paused');
  }, []);

  useVisibilityPause(pauseForVisibility, phase === 'play');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code !== 'Escape' && event.code !== 'KeyP') return;
      if (phase === 'play') {
        event.preventDefault();
        pause();
      } else if (phase === 'paused' || phase === 'inventory' || phase === 'crafting') {
        event.preventDefault();
        resume();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pause, phase, resume]);

  const applyPreferences = useCallback(
    (patch: Partial<CraftPreferences>) => {
      const next = sanitizePreferences({ ...preferencesRef.current, ...patch }, quality);
      preferencesRef.current = next;
      setPreferences(next);
      savePreferences(next);
      engineRef.current?.setSettings(next);
    },
    [quality],
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    writeMutedPreference(next);
    engineRef.current?.setMuted(next);
  }, []);

  const enterWorld = useCallback((record: SaveRecord) => {
    setPending(record);
    setPhase('loading');
  }, []);

  const createWorld = useCallback(
    async (slot: SaveSlot, name: string, seed: string) => {
      setSlotError(null);
      const trimmedName = name.trim().slice(0, 64) || `Rift World ${slot}`;
      const trimmedSeed = seed.trim().slice(0, 128) || randomSeed();
      try {
        const spawn = findSpawn(createTerrain(trimmedSeed));
        const record = createSave({
          slot,
          name: trimmedName,
          seed: trimmedSeed,
          now: Date.now(),
          spawn,
        });
        const store = storeRef.current;
        if (store) await store.write(record);
        enterWorld(record);
      } catch (cause) {
        setSlotError(`The world could not be created: ${messageOf(cause, 'unknown error')}`);
      }
    },
    [enterWorld],
  );

  const continueWorld = useCallback(
    async (slot: SaveSlot) => {
      setSlotError(null);
      const store = storeRef.current;
      if (!store) return;
      try {
        const result = await store.load(slot);
        if (result.status === 'ok') enterWorld(result.record);
        else if (result.status === 'unreadable') {
          setSlotError(`Slot ${slot} is unreadable: ${result.detail}`);
        } else {
          setSlotError(`Slot ${slot} is empty. Create a world instead.`);
        }
      } catch (cause) {
        setSlotError(`Slot ${slot} could not be loaded: ${messageOf(cause, 'unknown error')}`);
      }
    },
    [enterWorld],
  );

  const deleteSlot = useCallback(
    async (slot: SaveSlot) => {
      const store = storeRef.current;
      if (!store) return;
      try {
        await store.remove(slot);
        await refreshSlots();
      } catch (cause) {
        setSlotError(`Slot ${slot} could not be deleted: ${messageOf(cause, 'unknown error')}`);
      }
    },
    [refreshSlots],
  );

  const startUnsaved = useCallback(() => {
    try {
      const seed = randomSeed();
      const spawn = findSpawn(createTerrain(seed));
      enterWorld(
        createSave({
          slot: 1,
          name: 'Unsaved world',
          seed,
          now: Date.now(),
          spawn,
        }),
      );
    } catch (cause) {
      setSlotError(`The world could not be created: ${messageOf(cause, 'unknown error')}`);
    }
  }, [enterWorld]);

  const saveAndQuit = useCallback(async () => {
    const engine = engineRef.current;
    const store = storeRef.current;
    const record = engine ? engine.snapshot() : null;
    engine?.dispose();
    engineRef.current = null;

    if (record && store) {
      try {
        await store.write(record);
      } catch (cause) {
        setSlotError(`The world could not be saved: ${messageOf(cause, 'unknown error')}`);
      }
    }

    setPending(null);
    setDeath(null);
    setHud(START_HUD);
    setInventory(EMPTY_VIEW);
    setWorldName('New world');
    setPhase('menu');
    await refreshSlots();
  }, [refreshSlots]);

  const respawn = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.respawn();
    setDeath(null);
    setPhase('play');
    if (!touch) engine.requestPointerLock();
  }, [touch]);

  const selectSlot = useCallback((index: number) => {
    engineRef.current?.selectSlot(index);
  }, []);

  const moveSlot = useCallback((from: number, to: number) => {
    engineRef.current?.moveSlot(from, to);
  }, []);

  const moveTouch = useCallback((forward: number, strafe: number) => {
    engineRef.current?.setTouchMove(forward, strafe);
  }, []);

  const lookTouch = useCallback((dx: number, dy: number) => {
    engineRef.current?.lookBy(dx, dy);
  }, []);

  const touchButton = useCallback(
    (name: 'jump' | 'sneak' | 'sprint', down: boolean) => {
      engineRef.current?.setTouchButton(name, down);
    },
    [],
  );

  const mine = useCallback((down: boolean) => {
    if (down) engineRef.current?.pressPrimary();
    else engineRef.current?.releasePrimary();
  }, []);

  const place = useCallback(() => {
    engineRef.current?.useItem();
  }, []);

  const craftRecipe = useCallback(
    (recipeId: string) => {
      const engine = engineRef.current;
      if (!engine) return { ok: false as const, reason: 'missing' as const, missing: [] };
      return engine.craft(recipeId, craftingStation);
    },
    [craftingStation],
  );

  const inWorld = phase !== 'menu';

  return (
    <div
      className={
        inWorld
          ? 'relative min-h-[560px] w-full select-none overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink'
          : 'relative w-full'
      }
    >
      <canvas
        ref={canvasRef}
        className={
          inWorld
            ? 'absolute inset-0 h-full w-full touch-none'
            : 'pointer-events-none absolute h-0 w-0 opacity-0'
        }
        tabIndex={inWorld ? 0 : -1}
        aria-hidden={inWorld ? undefined : true}
        aria-label="Neon Craft first-person world. WASD to move, mouse to look, left click to mine, right click to place, E for inventory and Esc to pause."
      />
      <WebGLContextNotice lost={contextLost} />

      {phase === 'menu' ? (
        <CraftWorldSelect
          slots={slots}
          savingAvailable={savingAvailable}
          error={slotError}
          fatal={fatal}
          onRefresh={() => void refreshSlots()}
          onCreate={(slot, name, seed) => void createWorld(slot, name, seed)}
          onContinue={(slot) => void continueWorld(slot)}
          onDelete={(slot) => void deleteSlot(slot)}
          onStartUnsaved={startUnsaved}
        />
      ) : null}

      {phase !== 'menu' && phase !== 'loading' ? (
        <CraftHudView
          hud={hud}
          muted={muted}
          onPause={pause}
          onToggleMute={toggleMute}
          onOpenInventory={openInventory}
          onSelectSlot={selectSlot}
        />
      ) : null}

      {phase === 'play' && touch ? (
        <CraftTouchControls
          onMove={moveTouch}
          onLook={lookTouch}
          onButton={touchButton}
          onMine={mine}
          onPlace={place}
          onInventory={openInventory}
        />
      ) : null}

      {phase === 'inventory' ? (
        <CraftInventoryPanel
          view={inventory}
          onMove={moveSlot}
          onResume={resume}
          onOpenCrafting={() => setPhase('crafting')}
        />
      ) : null}

      {phase === 'crafting' ? (
        <CraftCraftingPanel
          station={craftingStation}
          view={inventory}
          onCraft={craftRecipe}
          onResume={resume}
          onOpenInventory={() => setPhase('inventory')}
        />
      ) : null}

      {phase === 'paused' ? (
        <CraftPausePanel
          worldName={worldName}
          preferences={preferences}
          quality={quality}
          muted={muted}
          saveError={saveError}
          onResume={resume}
          onSaveQuit={() => void saveAndQuit()}
          onChange={applyPreferences}
          onToggleMute={toggleMute}
        />
      ) : null}

      {phase === 'dead' && death ? (
        <CraftDeathPanel
          summary={death}
          onRespawn={respawn}
          onSaveQuit={() => void saveAndQuit()}
        />
      ) : null}

      {phase === 'loading' ? (
        <CraftLoadingScreen worldName={pending?.name ?? 'Neon Craft'} notice={fatal} />
      ) : null}

      {phase === 'play' && saveError ? (
        <p
          role="alert"
          className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full border border-coral/40 bg-night-950/90 px-3 py-1 text-[11px] text-coral backdrop-blur-md"
        >
          {saveError}
        </p>
      ) : null}
    </div>
  );
}