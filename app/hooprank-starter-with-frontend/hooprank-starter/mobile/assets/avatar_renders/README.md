# HoopRank Avatar Render Assets

This directory is legacy/reference material, not the scalable production avatar
path. The app should resolve profile and map avatars through production/provider
base-rig GLBs plus transparent sprites, or through explicit development flags
while the six-base-rig pipeline is being tested.

The historical static cutout pack is the `nextgen3d_*_cutout.png` set:

- `nextgen3d_guard_triple_threat_cutout.png`
- `nextgen3d_hoodie_crossed_arms_cutout.png`
- `nextgen3d_warmups_jumper_cutout.png`
- `nextgen3d_tee_dribble_cutout.png`

These are high-resolution RGBA PNG cutouts from an earlier generated/static
approach. They are not bundled in `pubspec.yaml` and must not be treated as the
production answer for avatar quality. The release path is the six reusable
base body rigs under `assets/avatar_models/catalog.json`.

Each legacy render is paired with a look-slot `modelAssetId` in
`lib/utils/generated_avatar.dart`, and those ids must match the layer-binding
slots in `assets/avatar_models/catalog.json`. The PNGs are fallback/poster QA
material only, not the final model pack.

`avatar_stage_console_bg.png` is the generated character-select court backdrop
used by `AvatarRenderStage`. It improves the avatar creator presentation but is
not a substitute for DCC-authored character art.

The older `ultra3d_*_cutout.png`, `pro3d_*_cutout.png`,
`aaa3d_*_cutout.png`, `elite3d_*_cutout.png`, `ps5_*_cutout.png`, and
`console_*_cutout.png` files are retained only for comparison while the
production rig pack is being finalized.

`quality_review.json` is the explicit art gate for the active pack. Normal
asset validation should pass for alpha, size, and framing:

```bash
dart run tool/validate_avatar_render_quality.dart
```

The final art gate intentionally fails until the visible renders are approved
DCC-authored production work:

```bash
dart run tool/validate_avatar_render_quality.dart --production-art
```

Replacement direction:

- Original fictional athlete only.
- Full body visible head to shoes.
- Premium sports-game 3D model quality.
- Basketball-specific outfit and stance.
- No NBA, team, player, or brand logos.
- Runtime customization from six base rigs: male/female x skinny/medium/big,
  with race/skin, hair, height, clothing, colors, and pose layered on top.
