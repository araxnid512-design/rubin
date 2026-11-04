# Tripo: аккаунт

## tripo auth whoami
```
Email:   <почта>
Profile: default
JWT:     expires in 2h 0m
```
## tripo account balance
```
Credits: 22080
Membership: premium
Subscription: premium (monthly)

```
## tripo account prices
```
PRODUCT                 MONTHLY   ANNUALLY
Basic                      free          -
Professional                  8        156
Professional 6k              21        234
Professional 12k             35        390
Premium                      90        540
Team                     132.00    1980.00

```
## tripo generate text --help
```
Generate a 3D model from text prompt

Usage:
  tripo generate text <prompt> [flags]

Flags:
      --face-limit int            Face limit (0 = auto)
      --format string             Export format for --output (glb, fbx, obj, usdz, stl, 3mf) (default "glb")
      --generate-parts            Generate as multiple parts
      --geometry-quality string   Geometry quality (original, detailed)
  -h, --help                      help for text
      --model-version string      Model version (v3.1-20260211, v3.0-20250812, v2.5-20250123, Nexus-v1.0-20260214, P-v1.0-20250506) (default "v3.1-20260211")
  -o, --output string             Download result to path (implies --wait)
      --pbr                       Enable PBR materials
      --quad                      Enable quad topology
      --texture                   Enable texture generation (default true)
      --texture-quality string    Texture quality (standard, detailed, extreme)
      --visibility string         Visibility (public, private, shareable) (default "public")
      --wait                      Wait for task completion

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr
```
## tripo process rig --help
```
Add skeleton rigging to a model.

Workflow: rigging_model requires the project's last operation to be a
successful pre_rig_check. Run `tripo process rig <project-id> --check` first;
once it reports Riggable: true, run the same command without --check to
submit the rigging task.

Usage:
  tripo process rig <project-id> [flags]

Flags:
      --check                  Only run pre-rig check, do not rig
      --format string          Export format (glb, fbx, obj, usdz, stl, 3mf) (default "glb")
  -h, --help                   help for rig
      --model-version string   Model version for the operation (default "v2.5-20260210")
  -o, --output string          Output file path (default: ./rig-<id-prefix>-<ts>.<ext>)
      --rig-type string        Rig type (biped, quadruped, ...) (default "biped")
      --submit-only            Submit task and return id; skip wait+export+download

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr
```
## tripo process animate --help
```
Apply animation tracks to a rigged model.

Prerequisite: the project must already have a successful rigging_model
operator (run `tripo process rig <project-id>` first).

The full-chain run produces a GLB whose animation tracks are assembled
from the new retarget operator. Pass --submit-only to skip the export
and just receive the operator id.

Usage:
  tripo process animate <project-id> [flags]

Flags:
      --animations strings     Animation names (e.g. preset:biped:run); repeatable or comma-separated
      --format string          Export format (glb, fbx, obj, usdz, stl, 3mf) (default "glb")
  -h, --help                   help for animate
      --model-version string   Model version for the operation (default "v2.5-20260210")
  -o, --output string          Output file path (default: ./animate-<id-prefix>-<ts>.<ext>)
      --rig-type string        Rig type of the parent model (biped, quadruped, ...) (default "biped")
      --submit-only            Submit task and return id; skip wait+export+download

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr
```
## tripo process --help
```
Post-process an existing model (rig, animate, texture, etc.)

Usage:
  tripo process [command]

Available Commands:
  animate     Apply animation to a rigged model
  refine      Submit model for pro refinement (returns a checkout URL)
  remesh      Retopologize a model
  rig         Add skeleton rigging to a model
  segment     AI segmentation — split a model into semantic parts
  texture     Generate or enhance textures on a model

Flags:
  -h, --help   help for process

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr

Use "tripo process [command] --help" for more information about a command.
```
## tripo export --help
```
Export and download a model in the specified format

Usage:
  tripo export <project-id> [flags]

Flags:
      --export-timeout duration    Export timeout (default 2m0s)
      --format string              Export format (glb, fbx, obj, usdz, stl, 3mf) (default "glb")
  -h, --help                       help for export
      --model-version string       Model version for export (default "v3.1-20260211")
      --operator-id string         Download a specific operator's model (skips export, uses download_with_name directly)
  -o, --output string              Output file path (default: ./<project-id>.<format>)
      --pack-uv                    Pack UV islands
      --pivot-to-center-bottom     Move pivot to center bottom
      --texture-packaging string   Texture packaging (embedded, zip) (default "embedded")
      --texture-size int           Texture size (0 = default)
      --with-animation             Include animation in export

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr
```
## tripo project get --help
```
Get project details

Usage:
  tripo project get <project-id> [flags]

Flags:
  -h, --help   help for get

Global Flags:
      --api-key string         API key (env: TRIPO_API_KEY)
      --base-url string        API base URL (env: TRIPO_BASE_URL)
      --dry-run                Print request payload without sending (debug mode)
      --output-format string   Output format: text, json, or table (env: TRIPO_OUTPUT_FORMAT)
      --profile string         Config profile to use (env: TRIPO_PROFILE)
  -q, --quiet                  Only output final result
      --timeout duration       Global timeout (env: TRIPO_TIMEOUT) (default 5m0s)
  -v, --verbose                Print request/response to stderr
```
