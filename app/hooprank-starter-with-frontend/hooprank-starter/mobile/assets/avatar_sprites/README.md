# Avatar Sprites

This directory is reserved for baked transparent avatar sprites rendered from
the six base body rigs plus runtime customization layers.

Files keep the full `generatedAvatarCustomizedSpriteId` in the manifest for
debugging and collision checks, but the actual `.webp` asset filename is a
compact deterministic hash from `generatedAvatarCustomizedSpriteAssetStem`.
These are deterministic game-render outputs, not AI-generated images and not
SVG/vector artwork.

The app starter pack is intentionally bounded to 96 sprites:
4 looks x 2 genders x 3 builds x 4 base appearances. Each one is rendered
from one of the six canonical base body rigs, with race, hair, outfit, color,
and pose applied as layers.

Bake the starter pack from the current variation manifest with:

```sh
python3 tool/generate_avatar_custom_sprite_pack.py --starter-pack
```

Small development samples can still be baked with:

```sh
python3 tool/generate_avatar_custom_sprite_pack.py --limit 12
```

The generated `sample_manifest.json` records which configs were baked and the
renderer version. The current local baker is a development volumetric
game-sprite renderer that projects real mesh geometry from the six base-body
specs; the same sprite ids should be reused when replacing these with approved
DCC/provider renders.

Each manifest item records `sourceBaseRigAssetId` and `rendererSource`; the
validator requires those to point back to the canonical six base body resolver
so look slots remain runtime layers rather than separate character bases.
The validator also enforces a total sprite byte budget so the app bundle does
not accidentally absorb the full 20k+ variation manifest.

Runtime sprite URLs resolve through `generatedAvatarBundledSpriteConfig`.
Requests outside the 96 bundled configs are canonicalized to the nearest
starter-pack render so map/profile UI stays on the higher-quality baked
game-render path instead of falling through to the lower-fidelity painter.

Validate the baked pack with:

```sh
dart run tool/validate_avatar_custom_sprite_pack.dart
```
