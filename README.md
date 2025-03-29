# Autopass-example

Example of using [Autopass](https://github.com/holepunchto/autopass) in an Expo application using <https://github.com/holepunchto/react-native-bare-kit>.

Works with [Pearpass-example](https://github.com/holepunchto/pearpass-example/)

## Usage

Start by installing the dependencies:

```sh
npm install
```

Generate a bundle

```sh
 npx bare-pack --target ios --target android  --linked --out app/app.bundle.mjs backend/backend.mjs
```

When finished, you can run the app on either iOS or Android.

### iOS

```sh
npm run ios
```

### Android

> [!IMPORTANT]  
> You may experience problems running the app on an emulated Android device under QEMU due to https://github.com/holepunchto/libjs/issues/4. If you encounter crashes, try running the app on a real Android device instead.

```sh
npm run android
```

## License

Apache-2.0
