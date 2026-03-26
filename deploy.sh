#!/bin/bash
# Reads Version from plugin.php header
# Builds with npm run build
# Packages only production files
# Outputs: doyle-salewski-debt-calculator-vX.X.X.zip

PLUGIN_SLUG="doyle-salewski-debt-calculator"
VERSION=$(grep "Version:" doyle-salewski-debt-calculator.php | head -1 | awk -F': ' '{print $2}' | tr -d '[:space:]')
DIST="../${PLUGIN_SLUG}-dist"
ZIP="../${PLUGIN_SLUG}-v${VERSION}.zip"

echo "→ Version: $VERSION"
echo "→ Building..."
npm run build

echo "→ Packaging..."
rm -rf "$DIST" "$ZIP"
mkdir -p "$DIST/$PLUGIN_SLUG"

cp doyle-salewski-debt-calculator.php "$DIST/$PLUGIN_SLUG/"
cp -r build/   "$DIST/$PLUGIN_SLUG/build/"
cp -r assets/  "$DIST/$PLUGIN_SLUG/assets/"
cp -r languages/ "$DIST/$PLUGIN_SLUG/languages/"
[ -d includes ] && cp -r includes/ "$DIST/$PLUGIN_SLUG/includes/"

cd "$DIST"
zip -r "$ZIP" "$PLUGIN_SLUG/"
cd -

echo "✓ Done: ${ZIP}"
du -sh "$ZIP"
