import {
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LogOut,
  Wind,
  Zap,
} from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { DriveInput } from './vehicle';

type Direction = 'up' | 'down' | 'left' | 'right';

export interface TouchControlsProps {
  inVehicle: boolean;
  canEnterCar: boolean;
  onMove: (key: Direction, pressed: boolean) => void;
  onSprint: (pressed: boolean) => void;
  onDrive: (key: keyof DriveInput, pressed: boolean) => void;
  onInteract: () => void;
}

function HoldButton({
  label,
  onHold,
  children,
  className,
}: {
  label: string;
  onHold: (pressed: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'grid h-12 w-12 touch-none select-none place-items-center rounded-2xl border border-white/15 bg-night-850/90 text-ink shadow-lg transition active:scale-95 active:border-mint/60 active:bg-mint/15',
        className,
      )}
      onPointerDown={(event) => {
        event.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onKeyDown={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          onHold(true);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') onHold(false);
      }}
    >
      {children}
    </button>
  );
}

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];

function directionFor(dx: number, dy: number): Record<Direction, boolean> {
  const threshold = 16;
  return {
    up: dy < -threshold,
    down: dy > threshold,
    left: dx < -threshold,
    right: dx > threshold,
  };
}

function WalkJoystick({ onMove }: { onMove: TouchControlsProps['onMove'] }) {
  const padRef = useRef<HTMLButtonElement>(null);
  const held = useRef<Record<Direction, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const apply = (dx: number, dy: number) => {
    const next = directionFor(dx, dy);
    for (const direction of DIRECTIONS) {
      if (next[direction] !== held.current[direction]) {
        held.current = { ...held.current, [direction]: next[direction] };
        onMove(direction, next[direction]);
      }
    }
    const magnitude = Math.hypot(dx, dy);
    const scale = magnitude > 40 ? 40 / magnitude : 1;
    setKnob({ x: dx * scale, y: dy * scale });
  };

  const release = () => {
    pointer.current = null;
    apply(0, 0);
  };

  const track = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    apply(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
  };

  return (
    <button
      ref={padRef}
      type="button"
      aria-label="Walk joystick"
      className="relative h-28 w-28 touch-none select-none rounded-full border border-white/15 bg-night-850/80 shadow-inner"
      onPointerDown={(event) => {
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        track(event);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) track(event);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-mint/40 bg-mint/20"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
      <span className="sr-only">Drag to walk</span>
    </button>
  );
}

export function TouchControls({
  inVehicle,
  canEnterCar,
  onMove,
  onSprint,
  onDrive,
  onInteract,
}: TouchControlsProps) {
  return (
    <div className="flex items-end justify-between gap-3 lg:hidden" data-touch-controls="">
      {inVehicle ? (
        <>
          <div className="flex gap-2">
            <HoldButton label="Steer left" onHold={(pressed) => onDrive('left', pressed)}>
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </HoldButton>
            <HoldButton label="Steer right" onHold={(pressed) => onDrive('right', pressed)}>
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </HoldButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HoldButton label="Drift" onHold={(pressed) => onDrive('handbrake', pressed)}>
              <Wind className="h-5 w-5" aria-hidden="true" />
            </HoldButton>
            <button
              type="button"
              aria-label="Step out of the Vela"
              onClick={onInteract}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-night-850/90 text-ink shadow-lg active:scale-95"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
            <HoldButton label="Brake" onHold={(pressed) => onDrive('back', pressed)}>
              <ChevronDown className="h-6 w-6" aria-hidden="true" />
            </HoldButton>
            <HoldButton label="Accelerate" onHold={(pressed) => onDrive('forward', pressed)}>
              <ChevronUp className="h-6 w-6" aria-hidden="true" />
            </HoldButton>
          </div>
        </>
      ) : (
        <>
          <WalkJoystick onMove={onMove} />
          <div className="flex flex-col gap-2">
            <HoldButton label="Sprint" onHold={onSprint}>
              <Zap className="h-5 w-5" aria-hidden="true" />
            </HoldButton>
            <button
              type="button"
              aria-label="Drive the Vela"
              onClick={onInteract}
              disabled={!canEnterCar}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-night-850/90 text-ink shadow-lg transition active:scale-95 disabled:opacity-40"
            >
              <Car className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
