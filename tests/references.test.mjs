import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dominantColors } from '../src/lib/referencePalette.ts';
import { briefingReferences, extractedReferencePalette } from '../src/lib/references.ts';

test('extracts dominant pixel colors, combines similar shades and ignores transparency', () => {
  const colors = new Uint8ClampedArray([
    255, 0, 0, 255, 255, 0, 0, 255, 240, 0, 0, 255,
    0, 255, 0, 255, 0, 255, 0, 255, 0, 0, 255, 0,
  ]);
  assert.deepEqual(dominantColors(colors), ['#FA0000', '#00FF00']);
  assert.deepEqual(dominantColors(new Uint8ClampedArray([255, 0, 0, 0])), []);
});

test('finds posts by style across niches and limits visual images to the current niche', () => {
  const references = [
    { id: 'fashion', niche: 'Moda', ai_insights: { reference_kind: 'post', visual_style: 'Moderno' } },
    { id: 'food', niche: 'Gastronomia', ai_insights: { reference_kind: 'post', visual_style: 'Móderno' } },
    { id: 'other-style', niche: 'Gastronomia', ai_insights: { reference_kind: 'post', visual_style: 'Retrô' } },
    { id: 'visual-food', niche: 'Gastronomia', ai_insights: {} },
    { id: 'visual-fashion', niche: 'Moda', ai_insights: {} },
  ];
  const result = briefingReferences(references, 'gastronomia', 'moderno');
  assert.deepEqual(result.posts.map(({ id }) => id), ['food', 'fashion']);
  assert.deepEqual(result.visuals.map(({ id }) => id), ['visual-food']);
  assert.deepEqual(extractedReferencePalette({ ai_insights: { color_palette: ['#06090E'] } }), []);
  assert.deepEqual(extractedReferencePalette({ ai_insights: { palette_source: 'image', color_palette: ['#112233'] } }), ['#112233']);
});
