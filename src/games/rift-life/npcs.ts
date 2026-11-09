export type NpcId = 'mara' | 'ilo' | 'sena' | 'tovan' | 'juno';

export interface ConversationChoice {
  label: string;
  relationship: number;
  community: number;
  energy: number;
  reply: string;
}

export interface SceneGate {
  at: number;
  title: string;
  text: string;
}

export interface Npc {
  id: NpcId;
  name: string;
  role: string;
  tagline: string;
  color: string;
  scene: SceneGate;
  choices: readonly [ConversationChoice, ConversationChoice];
}

export const NPCS: readonly Npc[] = [
  {
    id: 'mara',
    name: 'Mara Voss',
    role: 'Rig mechanic',
    tagline: 'Keeps the town lights on one weld at a time.',
    color: '#ffb84d',
    scene: {
      at: 25,
      title: 'The Bent Bolt',
      text: 'Mara shows you the wrench her mother carried, bent the night the first storm rolled through.',
    },
    choices: [
      {
        label: 'Trade tools',
        relationship: 6,
        community: 0,
        energy: -2,
        reply: 'She tests the balance and grins. “Come back when it needs another edge.”',
      },
      {
        label: 'Tell her the truth about the grid',
        relationship: 3,
        community: 4,
        energy: 0,
        reply: 'She listens without interrupting, then adds your name to the repair rota.',
      },
    ],
  },
  {
    id: 'ilo',
    name: 'Ilo Renn',
    role: 'Night-market cook',
    tagline: 'Feeds half the town and remembers every order.',
    color: '#ff8a5c',
    scene: {
      at: 25,
      title: 'The Shared Bowl',
      text: 'Ilo slides a second bowl across the counter without being asked. It is the first time you have eaten here without paying.',
    },
    choices: [
      {
        label: 'Share a bowl',
        relationship: 5,
        community: 1,
        energy: 6,
        reply: 'The broth is thick with pepper. “You looked like you needed it,” she says.',
      },
      {
        label: 'Help with the queue',
        relationship: 3,
        community: 5,
        energy: -4,
        reply: 'By closing time the line is gone and Ilo is laughing at your plating.',
      },
    ],
  },
  {
    id: 'sena',
    name: 'Sena Ahn',
    role: 'Signal archivist',
    tagline: 'Catalogues every transmission the rift lets through.',
    color: '#a06bff',
    scene: {
      at: 25,
      title: 'The Second Tape',
      text: 'Sena unlocks a drawer you have never seen and hands you a tape labelled with your own name.',
    },
    choices: [
      {
        label: 'Read the old logs',
        relationship: 6,
        community: 0,
        energy: -2,
        reply: 'Two hours vanish into static and margin notes. Sena watches you the whole time.',
      },
      {
        label: 'Report the signal',
        relationship: 3,
        community: 4,
        energy: 0,
        reply: 'She files it under your name and says the archive owes you a favour.',
      },
    ],
  },
  {
    id: 'tovan',
    name: 'Tovan Grey',
    role: 'Storm warden',
    tagline: 'Walks the sea wall so nobody else has to.',
    color: '#43f0c9',
    scene: {
      at: 25,
      title: 'The Wall at Dusk',
      text: 'Tovan leaves space at the rail for you. The two of you watch the storm break without saying a word.',
    },
    choices: [
      {
        label: 'Walk the wall',
        relationship: 5,
        community: 3,
        energy: -4,
        reply: 'Rain finds every seam in your coat. Tovan nods at your pace and slows to match it.',
      },
      {
        label: 'Rest together',
        relationship: 4,
        community: 0,
        energy: 6,
        reply: 'You sit in the lookout with tea gone cold and no one suggests moving.',
      },
    ],
  },
  {
    id: 'juno',
    name: 'Juno Pax',
    role: 'Kid inventor',
    tagline: 'Builds gliders from fence wire and bad ideas.',
    color: '#4c8dff',
    scene: {
      at: 25,
      title: 'The Fence-Wire Glider',
      text: 'Juno finally lets you hold the glider she has been hiding. It is heavier than it looks and smells of solder.',
    },
    choices: [
      {
        label: 'Test the glider',
        relationship: 6,
        community: 0,
        energy: -3,
        reply: 'It clips the awning and lands in a flower cart. Juno calls that a controlled descent.',
      },
      {
        label: 'Teach the class',
        relationship: 3,
        community: 5,
        energy: -2,
        reply: 'Six kids leave with working propellers and one very smug inventor.',
      },
    ],
  },
];

export const NPC_IDS: readonly NpcId[] = NPCS.map((npc) => npc.id);

export function npcById(id: NpcId): Npc {
  const found = NPCS.find((npc) => npc.id === id);
  if (!found) throw new Error(`Unknown NPC: ${id}`);
  return found;
}
