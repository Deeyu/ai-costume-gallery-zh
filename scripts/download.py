"""Mirror source images with bounded concurrency, retries and atomic writes."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from http.client import HTTPException
from pathlib import Path
import time
from urllib.request import Request, urlopen
from translate import ROOT
from sync import SOURCE

def valid(data, suffix):
    if suffix == '.png':
        return data.startswith(b'\x89PNG\r\n\x1a\n') and data.endswith(b'IEND\xaeB`\x82')
    return len(data) > 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP' and int.from_bytes(data[4:8], 'little') + 8 == len(data)

def download(path):
    target = ROOT / path
    if target.exists() and valid(target.read_bytes(), target.suffix):
        return
    for attempt in range(3):
        try:
            request = Request(SOURCE + path, headers={'User-Agent': 'Mozilla/5.0', 'Referer': SOURCE})
            with urlopen(request, timeout=45) as response:
                data = response.read()
            if not valid(data, target.suffix):
                raise ValueError('图片内容不完整或格式错误')
            target.parent.mkdir(exist_ok=True)
            temporary = target.with_suffix(target.suffix + '.part')
            temporary.write_bytes(data)
            temporary.replace(target)
            return
        except (OSError, ValueError, HTTPException):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--workers', type=int, default=8, choices=range(1, 33))
    parser.add_argument('--preview-only', action='store_true', help='仅下载缩略图与预览图')
    args = parser.parse_args()
    rows = json.loads((ROOT / 'data/costume.json').read_text())
    keys = ['サムネ', '画像'] if args.preview_only else ['サムネ', '画像', '原寸']
    paths = [row[key] for row in rows for key in keys]
    failed = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download, p): p for p in paths}
        for index, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as error:
                failed.append(futures[future])
                print(f'失败 {futures[future]}: {error}', flush=True)
            if index % 100 == 0:
                print(f'{index}/{len(paths)}', flush=True)
    print(f'完成：{len(paths)-len(failed)}/{len(paths)}')
    from manifest import main as update_manifest
    update_manifest()
    if failed:
        raise SystemExit(1)
