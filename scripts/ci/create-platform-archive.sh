#!/bin/bash
if [ "$OS" = "windows-latest" ]; then
  PLATFORM="windows"
  ARCHIVE_EXT="zip"
elif [ "$OS" = "macos-latest" ]; then
  PLATFORM="macos"
  ARCHIVE_EXT="tar.gz"
else
  PLATFORM="linux"
  ARCHIVE_EXT="tar.gz"
fi

# Use the archives created by package.sh script
if [ -f "pictallion_v1.0.0_"*".tar.gz" ]; then
  # Rename to include platform and version
  EXISTING_ARCHIVE=$(ls pictallion_v1.0.0_*.tar.gz | head -1)
  if [ "$OS" = "windows-latest" ]; then
    # For Windows, extract and repackage as ZIP
    mkdir temp_extract
    tar -xzf "$EXISTING_ARCHIVE" -C temp_extract
    cd temp_extract
    zip -r "../pictallion-${VERSION}-${PLATFORM}.zip" .
    cd ..
    rm -rf temp_extract
  else
    cp "$EXISTING_ARCHIVE" "pictallion-${VERSION}-${PLATFORM}.tar.gz"
  fi
else
  echo "❌ No package archive found"
  exit 1
fi