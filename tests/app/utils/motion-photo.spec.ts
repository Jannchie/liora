import { describe, expect, it } from 'vitest'
import {
  pairLivePhotoFiles,
  parseMotionPhoto,
  readMp4Duration,
  resolveLivePhotoEntries,
} from '../../../app/utils/motion-photo'

function ascii(text: string): number[] {
  return [...text].map(char => char.charCodeAt(0))
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF]
}

function box(type: string, payload: number[]): number[] {
  return [...uint32(8 + payload.length), ...ascii(type), ...payload]
}

/** Minimal MP4: ftyp + moov/mvhd (v0, timescale 600, given duration) + mdat. */
function mp4(brand = 'isom', durationSeconds = 3): number[] {
  const mvhd = box('mvhd', [0, 0, 0, 0, ...uint32(0), ...uint32(0), ...uint32(600), ...uint32(durationSeconds * 600), ...Array.from({ length: 80 }).fill(0)])
  return [
    ...box('ftyp', [...ascii(brand), ...uint32(0), ...ascii(brand)]),
    ...box('moov', mvhd),
    ...box('mdat', [1, 2, 3, 4]),
  ]
}

function jpeg(xmp = ''): number[] {
  return [0xFF, 0xD8, ...ascii(xmp), 0x11, 0x22, 0x33, 0xFF, 0xD9]
}

function file(name: string, bytes: number[], type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('app/utils/motion-photo', () => {
  it('locates a google motion photo through the xmp container item', () => {
    const video = mp4()
    const xmp = `<x:xmpmeta><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="${video.length}" Item:Padding="0"/> GCamera:MotionPhotoPresentationTimestampUs="1500000"</x:xmpmeta>`
    const still = jpeg(xmp)
    const layout = parseMotionPhoto(new Uint8Array([...still, ...video]))
    expect(layout).toEqual({
      videoStart: still.length,
      videoEnd: still.length + video.length,
      videoType: 'video/mp4',
      presentationTime: 1.5,
    })
  })

  it('locates a xiaomi micro video by its offset from the end', () => {
    const video = mp4('mp42')
    const still = jpeg(`<x:xmpmeta>GCamera:MicroVideoOffset="${video.length}"</x:xmpmeta>`)
    expect(parseMotionPhoto(new Uint8Array([...still, ...video]))?.videoStart).toBe(still.length)
  })

  it('falls back to scanning for the ftyp box and stops before trailing data', () => {
    const video = mp4('qt  ')
    const still = [...jpeg(), ...ascii('MotionPhoto_Data')]
    const trailer = ascii('SEFHjunk')
    const layout = parseMotionPhoto(new Uint8Array([...still, ...video, ...trailer]))
    expect(layout).toMatchObject({ videoStart: still.length, videoEnd: still.length + video.length, videoType: 'video/quicktime' })
  })

  it('ignores plain images, including a heic whose own ftyp is at offset 0', () => {
    expect(parseMotionPhoto(new Uint8Array(jpeg()))).toBeNull()
    const heic = box('ftyp', [...ascii('heic'), ...uint32(0), ...ascii('mif1')])
    expect(parseMotionPhoto(new Uint8Array([...heic, ...box('meta', [0, 0, 0, 0])]))).toBeNull()
  })

  it('reads the duration from mvhd', () => {
    expect(readMp4Duration(new Uint8Array(mp4('isom', 3)))).toBe(3)
  })

  it('pairs stills and videos by base name, keeping unpaired files', () => {
    const heic = file('IMG_0001.HEIC', [1], 'image/heic')
    const mov = file('img_0001.mov', [1], 'video/quicktime')
    const lone = file('IMG_0002.jpg', [1], 'image/jpeg')
    const clip = file('clip.mp4', [1], 'video/mp4')
    expect(pairLivePhotoFiles([mov, heic, lone, clip])).toEqual([
      { image: heic, video: mov },
      { image: lone, video: null },
      { image: null, video: clip },
    ])
  })

  it('splits a motion photo into a still and a video file', async () => {
    const video = mp4('isom', 2)
    const still = jpeg()
    const [entry] = await resolveLivePhotoEntries([file('PXL_1.MP.jpg', [...still, ...video], 'image/jpeg')])
    expect(entry?.image?.size).toBe(still.length)
    expect(entry?.image?.name).toBe('PXL_1.MP.jpg')
    expect(entry?.video?.size).toBe(video.length)
    expect(entry?.video?.name).toBe('PXL_1.MP.mp4')
    expect(entry?.stillTime).toBe(1)
  })
  it('splits a motion photo using only the slices the xmp points at', async () => {
    const video = mp4('mp42', 4)
    const still = jpeg(`<x:xmpmeta>GCamera:MicroVideoOffset="${video.length}" GCamera:MicroVideoPresentationTimestampUs="-1"</x:xmpmeta>`)
    const [entry] = await resolveLivePhotoEntries([file('MVIMG_1.jpg', [...still, ...video], 'image/jpeg')])
    expect(entry?.image?.size).toBe(still.length)
    expect(entry?.video?.type).toBe('video/mp4')
    expect(entry?.stillTime).toBe(2)
  })

  it('estimates the cover time of a heic + mov pair from the mov header', async () => {
    const [entry] = await resolveLivePhotoEntries([
      file('IMG_1.HEIC', [1], ''),
      file('IMG_1.MOV', mp4('qt  ', 3), ''),
    ])
    expect(entry?.video?.name).toBe('IMG_1.MOV')
    expect(entry?.stillTime).toBe(1.5)
  })
})
