import { ArrowUp, Backpack, EyeOff, Hammer, Plus, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

export interface CraftTouchControlsProps {
  onMove(forward: number, strafe: number): void;
  onLook(dx: number, dy: number): void;
  onButton(name: 'jump' | 'sneak' | 'sprint', down: boolean): void;
  onMine(down: boolean): void;
  onPlace(): void;
  onInventory(): void;
}

function TouchButton({
  label,
  onPress,
  onRelease,
  className,
  children,
}: {
  label: string;
  onPress(): void;
  onRelease(): void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onPointerLeave={onRelease}
      onContextMenu={(event) => event.preventDefault()}
      className={`grid select-none place-items-center border border-white/15 bg-white/10 text-white backdrop-blur-md active:bg-mint/30 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

function TouchStick({ onMove }: { onMove(forward: number, strafe: number): void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function update(event: ReactPointerEvent<HTMLDivElement>) {
    const base = baseRef.current;
    if (!base || activePointer.current !== event.pointerId) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width / 2 - 12;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }
    setKnob({ x: dx, y: dy });
    onMove(-dy / max, dx / max);
  }

  function release() {
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  }

  return (
    <div
      ref={baseRef}
      role="group"
      aria-label="Movement stick"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointer.current = event.pointerId;
        update(event);
      }}
      onPointerMove={update}
      onPointerUp={release}
      onPointerCancel={release}
      className="pointer-events-auto relative h-28 w-28 touch-none rounded-full border border-white/15 bg-night-950/55 backdrop-blur-md"
    >
      <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-mint/50 bg-mint/25"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

function LookPad({ onLook }: { onLook(dx: number, dy: number): void }) {
  const activePointer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  return (
    <div
      role="group"
      aria-label="Look area. Drag to look around."
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activePointer.current = event.pointerId;
        last.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (activePointer.current !== event.pointerId) return;
        const dx = event.clientX - last.current.x;
        const dy = event.clientY - last.current.y;
        last.current = { x: event.clientX, y: event.clientY };
        if (dx !== 0 || dy !== 0) onLook(dx * 1.6, dy * 1.6);
      }}
      onPointerUp={() => {
        activePointer.current = null;
      }}
      onPointerCancel={() => {
        activePointer.current = null;
      }}
      className="pointer-events-auto absolute bottom-40 right-0 top-16 w-1/2 touch-none"
    />
  );
}

export function CraftTouchControls({
  onMove,
  onLook,
  onButton,
  onMine,
  onPlace,
  onInventory,
}: CraftTouchControlsProps) {
  useEffect(() => () => onMove(0, 0), [onMove]);

  return (
    <>
      <LookPad onLook={onLook} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 pb-4">
        <div className="pointer-events-auto">
          <TouchStick onMove={onMove} />
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <TouchButton
              label="Inventory"
              onPress={onInventory}
              onRelease={() => undefined}
              className="h-11 w-11 rounded-xl"
            >
              <Backpack className="h-5 w-5" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Sneak"
              onPress={() => onButton('sneak', true)}
              onRelease={() => onButton('sneak', false)}
              className="h-11 w-11 rounded-xl"
            >
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Sprint"
              onPress={() => onButton('sprint', true)}
              onRelease={() => onButton('sprint', false)}
              className="h-11 w-11 rounded-xl"
            >
              <Zap className="h-5 w-5" aria-hidden="true" />
            </TouchButton>
          </div>
          <div className="flex items-end gap-2">
            <TouchButton
              label="Place block or use item"
              onPress={onPlace}
              onRelease={() => undefined}
              className="h-14 w-14 rounded-2xl"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Mine or attack"
              onPress={() => onMine(true)}
              onRelease={() => onMine(false)}
              className="h-16 w-16 rounded-2xl bg-mint/25"
            >
              <Hammer className="h-7 w-7" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Jump"
              onPress={() => onButton('jump', true)}
              onRelease={() => onButton('jump', false)}
              className="h-14 w-14 rounded-2xl"
            >
              <ArrowUp className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
          </div>
        </div>
      </div>
    </>
  );
}