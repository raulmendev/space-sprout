import { CREW, NpcId, PetId } from '@garden/shared';
import { PET_FRAMES, crewPortraitKey } from '../garden/game/asset-registry';

/** Who an NPC is: name and role for the speech bubble, texture for the map and portrait. */
export const NPC_IDENTITY: Record<NpcId, { name: string; role: string | null; texture: string }> = {
  DOG: { name: 'Bolita', role: 'Station pup', texture: PET_FRAMES.DOG.idle.down },
  CAT: { name: 'Miso', role: 'Station cat', texture: PET_FRAMES.CAT.idle.down },
  RADISH: { name: 'Rabanito', role: 'Garden guide', texture: PET_FRAMES.RADISH.idle.down },
  ...(Object.fromEntries(CREW.map((c) => [c.id, { name: c.name, role: c.role, texture: crewPortraitKey(c.id) }])) as Record<
    Exclude<NpcId, PetId>,
    { name: string; role: string; texture: string }
  >),
};
