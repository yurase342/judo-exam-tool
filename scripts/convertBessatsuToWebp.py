#!/usr/bin/env python3
"""
別冊PDFをWebP画像に変換するPythonスクリプト

使用方法:
    python scripts/convertBessatsuToWebp.py

必要なパッケージ:
    pip install pdf2image Pillow

追加で必要なもの:
    - macOS: brew install poppler
    - Ubuntu: sudo apt-get install poppler-utils
    - Windows: http://blog.alivate.com.au/poppler-windows/
"""

import os
import sys
from pathlib import Path

try:
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError:
    print("必要なパッケージがインストールされていません。")
    print("以下のコマンドでインストールしてください:")
    print("  pip install pdf2image Pillow")
    print("\nまた、popplerもシステムにインストールする必要があります:")
    print("  macOS: brew install poppler")
    print("  Ubuntu: sudo apt-get install poppler-utils")
    sys.exit(1)

# 設定
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent

CONFIG = {
    # 入力: 別冊PDFファイルの配置場所
    "input_dir": PROJECT_DIR / "public" / "pdfs",

    # 出力: WebP画像の出力先
    "output_dir": PROJECT_DIR / "public" / "data" / "bessatsu",

    # 別冊PDFのファイルマッピング
    "bessatsu_files": [
        {"exam_number": 29, "session": "gozen", "filename": "2021_29_gozen_bessatsu.pdf"},
        {"exam_number": 29, "session": "gogo", "filename": "2021_29_gogo_bessatsu.pdf"},
        {"exam_number": 30, "session": "gozen", "filename": "2022_30_gozen_bessatsu.pdf"},
        {"exam_number": 30, "session": "gogo", "filename": "2022_30_gogo_bessatsu.pdf"},
        {"exam_number": 31, "session": "gozen", "filename": "2023_31_gozen_bessatsu.pdf"},
        {"exam_number": 31, "session": "gogo", "filename": "2023_31_gogo_bessatsu.pdf"},
        {"exam_number": 32, "session": "gozen", "filename": "2024_32_gozen_bessatsu.pdf"},
        {"exam_number": 32, "session": "gogo", "filename": "2024_32_gogo_bessatsu.pdf"},
        {"exam_number": 33, "session": "gozen", "filename": "2025_33_gozen_bessatsu.pdf"},
        {"exam_number": 33, "session": "gogo", "filename": "2025_33_gozen_bessatsu.pdf"},  # 午後も午前の別冊を使用
    ],

    # WebP品質（0-100）
    "webp_quality": 85,

    # 画像解像度（DPI）
    "dpi": 200,
}


def main():
    print("=== 別冊PDF → WebP 変換スクリプト ===\n")

    # 出力ディレクトリを作成
    CONFIG["output_dir"].mkdir(parents=True, exist_ok=True)

    total_converted = 0
    total_failed = 0

    for bessatsu in CONFIG["bessatsu_files"]:
        pdf_path = CONFIG["input_dir"] / bessatsu["filename"]

        if not pdf_path.exists():
            print(f"⚠️  スキップ: {bessatsu['filename']} (ファイルが見つかりません)")
            continue

        print(f"📄 処理中: {bessatsu['filename']}")

        # 出力ディレクトリを作成
        output_sub_dir = CONFIG["output_dir"] / str(bessatsu["exam_number"]) / bessatsu["session"]
        output_sub_dir.mkdir(parents=True, exist_ok=True)

        try:
            # PDFを画像に変換
            images = convert_from_path(
                str(pdf_path),
                dpi=CONFIG["dpi"],
                fmt="png"
            )

            for page_number, image in enumerate(images, start=1):
                webp_path = output_sub_dir / f"{page_number}.webp"

                # WebPとして保存
                image.save(
                    str(webp_path),
                    "WEBP",
                    quality=CONFIG["webp_quality"]
                )

                size_kb = webp_path.stat().st_size / 1024
                print(f"   ✅ ページ {page_number} → {size_kb:.1f}KB")
                total_converted += 1

        except Exception as e:
            print(f"   ❌ エラー: {e}")
            total_failed += 1

    print("\n=== 変換完了 ===")
    print(f"✅ 成功: {total_converted} ページ")
    if total_failed > 0:
        print(f"❌ 失敗: {total_failed} ファイル")
    print(f"\n出力先: {CONFIG['output_dir']}")


if __name__ == "__main__":
    main()
