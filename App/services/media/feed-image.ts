import * as ImageManipulator from "expo-image-manipulator";

const FEED_IMAGE_MAX_WIDTH = 1600;
const FEED_IMAGE_QUALITY = 0.76;

/** Produces a display-sized JPEG before it is uploaded to a public feed. */
export async function compressFeedImage(localUri: string) {
  const image = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: FEED_IMAGE_MAX_WIDTH } }],
    { compress: FEED_IMAGE_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return image.uri;
}
