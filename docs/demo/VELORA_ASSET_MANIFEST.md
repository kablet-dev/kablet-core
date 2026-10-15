# VELORA Development Fixture Asset Manifest

Status: validated locally on October 15, 2026.

VELORA is a fictional, development-only skincare merchant used to validate Kablet's entry composition strategies. These assets must remain local and must never be treated as production merchant records.

## Validated local assets

Place the files under `apps/web/public/demo/velora/` with these exact paths:

Creator/source for every file: OpenAI image generation, supplied for this fictional Kablet development demo.

Date obtained: October 15, 2026.

Intended use: local VELORA development and visual testing only.

The five files are individual JPEG assets extracted from the VELORA asset sheet. They are not the composite Northstar UI reference image. The generated packaging labels and portrayed products are fictional illustrative artwork, not verified merchant claims or inventory.

| Asset | Exact relative filename | Dimensions | Size | SHA-256 | Intended use |
|---|---|---:|---:|---|---|
| Lifestyle/editorial campaign image | `editorial/velora-botanical-campaign.jpg` | 1512 × 423 | 169,027 bytes | `5752689ace4529b4dad21cbc6407a765952f868ca56467ce90b6e7996530d400` | Editorial Entry preview |
| Botanical Veil Cleanser | `products/botanical-veil-cleanser.jpg` | 367 × 451 | 46,043 bytes | `f0893ab212da51019125acd481d42e00251217840b9eb4d0c3e23824c39a62b8` | Product-Led Entry and product card |
| Canopy Dew Serum | `products/canopy-dew-serum.jpg` | 378 × 451 | 51,265 bytes | `d428a9a6d1337de9f44f3e4230a2ce4d94d34258bda73f169a9f045455777254` | Product-Led Entry and product card |
| Mosslight Barrier Cream | `products/mosslight-barrier-cream.jpg` | 389 × 451 | 48,270 bytes | `7d71ca4d0fee0264c0b7631029118f25fc180d006383d8e74c4d58dafbb89245` | Product card and comparison |
| Sunlit Herb Balm | `products/sunlit-herb-balm.jpg` | 362 × 451 | 56,171 bytes | `4f3a452a53f6aa3a47f0099f69c97ec64c79654dae636af84313f23f0102f2a5` | Product card and comparison |

Optional supporting botanical photography may be added under `botanical/`, but the runtime does not require it and the seed does not reference it.

## Provenance record

No third-party license or exclusive copyright is claimed. The supplied provenance file is retained at `apps/web/public/demo/velora/ASSET_PROVENANCE.md`. Before adding another image, update this section with:

- source or creator;
- usage authorization or license, if applicable;
- date obtained;
- local filename and checksum;
- confirmation that it is not the composite UI reference image.

The attached Northstar composite UI reference was not used as a product or campaign asset.
