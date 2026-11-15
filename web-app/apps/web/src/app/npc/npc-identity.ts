import { CREW, NpcId } from '@garden/shared';
import { NPC_TEXTURE, crewTextureKey } from '../garden/game/asset-registry';

/** Who an NPC is: name and role for the speech bubble, texture for the map and portrait. */
export const NPC_IDENTITY: Record<NpcId, { name: string; role: string | null; texture: string }> = {
  SPROUT: { name: 'Sprout', role: null, texture: NPC_TEXTURE },
  ...(Object.fromEntries(CREW.map((c) => [c.id, { name: c.name, role: c.role, texture: crewTextureKey(c.id) }])) as Record<
    Exclude<NpcId, 'SPROUT'>,
    { name: string; role: string; texture: string }
  >),
};
