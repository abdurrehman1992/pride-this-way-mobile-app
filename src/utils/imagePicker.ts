import { launchImageLibrary } from 'react-native-image-picker'

export const pickImageFromGallery = async () => {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    })

    if (result.didCancel) return null

    const uri = result.assets?.[0]?.uri
    return uri || null
  } catch (error) {
    // console.log('Image picker error:', error)
    return null
  }
}