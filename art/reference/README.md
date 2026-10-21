# Art reference

`alley-gold.png` is the target look for the game's art. New art is judged against it.

`alley-gold-raw.png` is the same render before the pixel refiner.

## How it was made

| Setting | Value |
|---|---|
| Generator | ComfyUI v0.26.2 (`comfyui_v26` in the image_gen stack) |
| Model | `krea2_turbo_fp8_scaled.safetensors`, text encoder `qwen3vl_4b_bf16.safetensors` (type `krea2`), VAE `qwen_image_vae.safetensors` |
| LoRA | `k2-pixel128.safetensors`, strength 1.0, through `LoraLoaderModelOnly` |
| Sampler | `KSampler`, 8 steps, cfg 1.0, `euler`, `simple`, seed 11, 1024 × 1024 |
| Negative | `ConditioningZeroOut` of the positive |
| Refiner | `Krea2PixelArtRefiner` ([ComfyUI-Krea2-Pixel-Art-Refiner](https://github.com/envy-ai/ComfyUI-Krea2-Pixel-Art-Refiner)): 128 × 128 grid, 24 colours, colour reduction first, scaled back to 1024 |

Prompt:

> pixel art screenshot of a top-down puzzle video game, a raccoon in a city back alley at night
> on a square tile grid, trash bags, blue recycling bins, an old couch, puddles, cozy colorful
> lighting

The plain `k2-pixel128.safetensors` stores its DoRA magnitude under the key `magnitude`. ComfyUI
reads DoRA only from `dora_scale`, so this render used the LoRA without its magnitude. A
re-render with a converted file will not match this image.
