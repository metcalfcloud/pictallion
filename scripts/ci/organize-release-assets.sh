#!/bin/bash
mkdir -p release_assets
find artifacts -name "pictallion-*" -type f -exec cp {} release_assets/ \;
ls -la release_assets/