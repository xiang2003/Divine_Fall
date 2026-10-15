"""Renders pictures from docs/art/prop-prompts.json with the local ComfyUI (Z-Image-Turbo, no LoRA) and saves them as docs/art/props/<name>.webp.

Usage:  python tools/gen_zimage.py <name> [<name> ...] [--seed N]   (ComfyUI must be running on 127.0.0.1:8188)
Needs Pillow. Developer tool only; the game never runs it. Each entry of the json has a seed, steps, sampler, size ("1024x1024") and prompt.
`--seed N` renders with another seed without touching the json (the picture is then saved as <name>_s<N>.webp so it can be compared).
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / 'docs' / 'art' / 'prop-prompts.json'
OUT = ROOT / 'docs' / 'art' / 'props'
HOST = 'http://127.0.0.1:8188'


def graph(prompt: str, seed: int, steps: int, sampler: str, width: int, height: int) -> dict:
    """The Z-Image-Turbo graph of ComfyUI's template, in API format."""
    return {
        '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_bf16.safetensors', 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b.safetensors', 'type': 'lumina2', 'device': 'default'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
        '4': {'class_type': 'CLIPTextEncode', 'inputs': {'text': prompt, 'clip': ['2', 0]}},
        '5': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['4', 0]}},
        '6': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': width, 'height': height, 'batch_size': 1}},
        '7': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'model': ['1', 0], 'shift': 3}},
        '8': {
            'class_type': 'KSampler',
            'inputs': {
                'model': ['7', 0], 'positive': ['4', 0], 'negative': ['5', 0], 'latent_image': ['6', 0],
                'seed': seed, 'steps': steps, 'cfg': 1, 'sampler_name': sampler, 'scheduler': 'simple', 'denoise': 1,
            },
        },
        '9': {'class_type': 'VAEDecode', 'inputs': {'samples': ['8', 0], 'vae': ['3', 0]}},
        '10': {'class_type': 'SaveImage', 'inputs': {'images': ['9', 0], 'filename_prefix': 'gen_zimage'}},
    }


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(HOST + path, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req))


def render(name: str, entry: dict, seed: int | None) -> Path:
    width, height = (int(v) for v in entry.get('size', '1024x1024').split('x'))
    use_seed = entry['seed'] if seed is None else seed
    pid = post('/prompt', {'prompt': graph(entry['prompt'], use_seed, entry.get('steps', 8), entry.get('sampler', 'res_multistep'), width, height)})['prompt_id']
    while True:
        history = json.load(urllib.request.urlopen(f'{HOST}/history/{pid}'))
        if pid in history and history[pid].get('outputs'):
            break
        time.sleep(1.5)
    image = history[pid]['outputs']['10']['images'][0]
    query = urllib.parse.urlencode({'filename': image['filename'], 'subfolder': image['subfolder'], 'type': image['type']})
    picture = Image.open(BytesIO(urllib.request.urlopen(f'{HOST}/view?{query}').read())).convert('RGB')
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / (f'{name}.webp' if seed is None else f'{name}_s{seed}.webp')
    picture.save(target, quality=95)
    return target


def main() -> None:
    args = sys.argv[1:]
    seed = None
    if '--seed' in args:
        i = args.index('--seed')
        seed = int(args[i + 1])
        del args[i:i + 2]
    prompts = json.loads(PROMPTS.read_text(encoding='utf8'))
    for name in args:
        print(name, '->', render(name, prompts[name], seed), flush=True)


if __name__ == '__main__':
    main()
