import { describe, expect, it } from 'vitest';
import {
  MISSIONS,
  advanceMission,
  beginMission,
  nextTarget,
  rankFor,
  rewardFor,
  type MissionEvent,
  type MissionSnapshot,
} from './missions';
import { SOLARA_LANDMARKS, isOnRoad } from './world';

function landmarkPosition(id: string): { x: number; y: number } {
  const landmark = SOLARA_LANDMARKS.find((entry) => entry.id === id);
  if (!landmark) throw new Error(`Unknown landmark ${id}`);
  return { x: landmark.x, y: landmark.y };
}

function snapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    dt: 1 / 60,
    position: { x: 0, y: 0 },
    inVehicle: false,
    landmarkId: null,
    ...overrides,
  };
}

describe('mission catalogue', () => {
  it('lists the four handcrafted missions in unlock order', () => {
    expect(MISSIONS.map((mission) => mission.id)).toEqual([
      'tideglass-courier',
      'lantern-circuit',
      'landmark-trail',
      'glow-run',
    ]);
    expect(MISSIONS.map((mission) => mission.unlocks)).toEqual([
      'lantern-circuit',
      'landmark-trail',
      'glow-run',
      null,
    ]);
    expect(MISSIONS.filter((mission) => mission.repeatable).map((mission) => mission.id)).toEqual([
      'glow-run',
    ]);
  });
});

describe('objective targeting', () => {
  it('points the HUD at the next thing to do', () => {
    const courier = beginMission('tideglass-courier', 1);
    expect(nextTarget(courier)).toEqual(landmarkPosition('tideglass-market'));
    expect(nextTarget({ ...courier, pickedUp: true })).toEqual(
      landmarkPosition('coral-radio-tower'),
    );

    const circuit = beginMission('lantern-circuit', 4);
    expect(nextTarget(circuit)).toEqual(circuit.gates[0]);
    expect(nextTarget({ ...circuit, gateIndex: 3 })).toEqual(circuit.gates[3]);

    const glow = beginMission('glow-run', 21);
    expect(nextTarget(glow)).toEqual(glow.shards[0]);
    expect(nextTarget({ ...glow, collected: [0] })).toEqual(glow.shards[1]);
    expect(nextTarget({ ...glow, collected: [0, 1, 2, 3, 4, 5, 6, 7] })).toBeNull();

    expect(nextTarget(beginMission('landmark-trail', 2))).toBeNull();
  });
});

describe('Tideglass Courier', () => {
  it('requires the market pickup before the tower delivery', () => {
    const started = beginMission('tideglass-courier', 1);

    const early = advanceMission(
      started,
      snapshot({ position: landmarkPosition('coral-radio-tower') }),
    );
    expect(early.events).toEqual([]);
    expect(early.runtime.status).toBe('active');

    const picked = advanceMission(
      early.runtime,
      snapshot({ position: landmarkPosition('tideglass-market') }),
    );
    expect(picked.events).toEqual<MissionEvent[]>([{ type: 'checkpoint', id: 'courier-pickup' }]);
    expect(picked.runtime.pickedUp).toBe(true);

    const delivered = advanceMission(
      picked.runtime,
      snapshot({ position: landmarkPosition('coral-radio-tower') }),
    );
    expect(delivered.events).toEqual<MissionEvent[]>([{ type: 'complete' }]);
    expect(delivered.runtime.status).toBe('complete');
  });

  it('fails once the clock runs out', () => {
    const started = beginMission('tideglass-courier', 1);
    const expired = advanceMission(started, snapshot({ dt: 101 }));
    expect(expired.runtime.status).toBe('failed');
    expect(expired.events).toEqual<MissionEvent[]>([{ type: 'failed' }]);
    expect(advanceMission(expired.runtime, snapshot()).events).toEqual([]);
  });
});

describe('Lantern Circuit', () => {
  it('only advances gates from a vehicle and in order', () => {
    const started = beginMission('lantern-circuit', 4);
    expect(started.gates).toHaveLength(8);

    const onFoot = advanceMission(started, snapshot({ position: started.gates[0], inVehicle: false }));
    expect(onFoot.runtime.gateIndex).toBe(0);
    expect(onFoot.events).toEqual([]);

    const outOfOrder = advanceMission(started, snapshot({ position: started.gates[1], inVehicle: true }));
    expect(outOfOrder.runtime.gateIndex).toBe(0);
    expect(outOfOrder.events).toEqual([]);

    const first = advanceMission(started, snapshot({ position: started.gates[0], inVehicle: true }));
    expect(first.runtime.gateIndex).toBe(1);
    expect(first.events).toEqual<MissionEvent[]>([{ type: 'checkpoint', id: 'gate-1' }]);
  });

  it('completes after every gate in sequence', () => {
    let runtime = beginMission('lantern-circuit', 4);
    const events: MissionEvent[] = [];
    for (const gate of runtime.gates) {
      const result = advanceMission(runtime, snapshot({ position: gate, inVehicle: true }));
      runtime = result.runtime;
      events.push(...result.events);
    }
    expect(runtime.status).toBe('complete');
    expect(events.filter((event) => event.type === 'checkpoint')).toHaveLength(8);
    expect(events.filter((event) => event.type === 'complete')).toHaveLength(1);
  });

  it('places every gate on the street grid', () => {
    const started = beginMission('lantern-circuit', 4);
    for (const gate of started.gates) expect(isOnRoad(gate.x, gate.y)).toBe(true);
  });
});

describe('Landmark Trail', () => {
  it('completes at five discoveries and ignores repeats', () => {
    let runtime = beginMission('landmark-trail', 2);
    const ids = [
      'vela-garage',
      'tideglass-market',
      'coral-radio-tower',
      'lantern-pier',
      'sunset-steps',
    ];
    const events: MissionEvent[] = [];
    for (const id of ids) {
      const result = advanceMission(runtime, snapshot({ landmarkId: id }));
      runtime = result.runtime;
      events.push(...result.events);
    }
    expect(runtime.discovered).toHaveLength(5);
    expect(events.filter((event) => event.type === 'discover')).toHaveLength(5);
    expect(runtime.status).toBe('complete');

    const afterFinish = advanceMission(runtime, snapshot({ landmarkId: ids[0] }));
    expect(afterFinish.events).toEqual([]);
    expect(afterFinish.runtime.discovered).toHaveLength(5);
  });

  it('does not count a duplicate landmark toward the five', () => {
    let runtime = beginMission('landmark-trail', 2);
    for (const id of [
      'vela-garage',
      'vela-garage',
      'tideglass-market',
      'coral-radio-tower',
      'lantern-pier',
    ]) {
      runtime = advanceMission(runtime, snapshot({ landmarkId: id })).runtime;
    }
    expect(runtime.discovered).toHaveLength(4);
    expect(runtime.status).toBe('active');
  });

  it('ignores unknown landmark ids', () => {
    const started = beginMission('landmark-trail', 2);
    const result = advanceMission(started, snapshot({ landmarkId: 'atlantis-casino' }));
    expect(result.runtime.discovered).toEqual([]);
    expect(result.events).toEqual([]);
  });
});

describe('Glow Run', () => {
  it('places eight distinct seeded shards on the street grid', () => {
    const first = beginMission('glow-run', 21);
    const repeat = beginMission('glow-run', 21);
    const other = beginMission('glow-run', 22);

    expect(first.shards).toHaveLength(8);
    expect(first.shards).toEqual(repeat.shards);
    expect(first.shards).not.toEqual(other.shards);

    const keys = new Set(first.shards.map((shard) => `${shard.x},${shard.y}`));
    expect(keys.size).toBe(8);
    for (const shard of first.shards) expect(isOnRoad(shard.x, shard.y)).toBe(true);
  });

  it('collects each shard once and finishes on a clean sweep', () => {
    let runtime = beginMission('glow-run', 21);
    const events: MissionEvent[] = [];
    for (const shard of runtime.shards) {
      const collected = advanceMission(runtime, snapshot({ position: shard }));
      runtime = collected.runtime;
      events.push(...collected.events);

      const again = advanceMission(runtime, snapshot({ position: shard }));
      expect(again.events).toEqual([]);
      runtime = again.runtime;
    }
    expect(runtime.collected).toHaveLength(8);
    expect(runtime.status).toBe('complete');
    expect(events.filter((event) => event.type === 'shard')).toHaveLength(8);
    expect(events.filter((event) => event.type === 'complete')).toHaveLength(1);
  });

  it('can start a fresh run with a new seed', () => {
    const first = beginMission('glow-run', 21);
    const second = beginMission('glow-run', 22);
    expect(first.shards).not.toEqual(second.shards);
    expect(second.collected).toEqual([]);
    expect(second.status).toBe('active');
  });
});

describe('rewards', () => {
  it('pays the published amount for each mission', () => {
    expect(rewardFor('tideglass-courier', { completed: true, shards: 0 })).toBe(450);
    expect(rewardFor('lantern-circuit', { completed: true, shards: 0 })).toBe(800);
    expect(rewardFor('landmark-trail', { completed: true, shards: 0 })).toBe(600);
  });

  it('pays Glow Run per shard plus a clean-sweep bonus', () => {
    expect(rewardFor('glow-run', { completed: true, shards: 8 })).toBe(570);
    expect(rewardFor('glow-run', { completed: false, shards: 3 })).toBe(120);
  });

  it('pays nothing for an unfinished handcrafted mission', () => {
    expect(rewardFor('tideglass-courier', { completed: false, shards: 0 })).toBe(0);
    expect(rewardFor('lantern-circuit', { completed: false, shards: 0 })).toBe(0);
    expect(rewardFor('landmark-trail', { completed: false, shards: 0 })).toBe(0);
  });
});

describe('ranks', () => {
  it('follows the completed mission count', () => {
    expect(rankFor([])).toBe('Newcomer');
    expect(rankFor(['tideglass-courier'])).toBe('Local');
    expect(rankFor(['tideglass-courier', 'lantern-circuit'])).toBe('Runner');
    expect(rankFor(['tideglass-courier', 'lantern-circuit', 'landmark-trail'])).toBe('Insider');
    expect(
      rankFor(['tideglass-courier', 'lantern-circuit', 'landmark-trail', 'glow-run']),
    ).toBe('Coast Legend');
  });

  it('ignores duplicates', () => {
    expect(rankFor(['tideglass-courier', 'tideglass-courier'])).toBe('Local');
  });
});
