import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

const USERS_COLLECTION = 'users';

export type AuthUserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

export type AuthSession = {
  user: AuthUserProfile;
  token: string;
};

type SignupPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type UpdateProfilePayload = {
  fullName: string;
  email: string;
  phone: string;
};

const getFriendlyAuthMessage = (error: any) => {
  const code = error?.code;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
};

const getUserDocumentRef = (uid: string) =>
  firestore().collection(USERS_COLLECTION).doc(uid);

const getUserDocument = async (uid: string) => {
  const snapshot = await getUserDocumentRef(uid).get();
  return snapshot.exists ? snapshot.data() : null;
};

const upsertUserDocument = async ({
  uid,
  fullName,
  email,
  phone,
}: {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
}) => {
  const docRef = getUserDocumentRef(uid);
  const existingSnapshot = await docRef.get();
  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();

  const payload: FirebaseFirestoreTypes.UpdateData = {
    uid,
    name: trimmedName,
    fullName: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  if (!existingSnapshot.exists) {
    payload.createdAt = firestore.FieldValue.serverTimestamp();
  }

  await docRef.set(payload, { merge: true });

  return getUserDocument(uid);
};

const buildAuthSession = async (
  firebaseUser: FirebaseAuthTypes.User,
  profile?: FirebaseFirestoreTypes.DocumentData | null
): Promise<AuthSession> => {
  const token = await firebaseUser.getIdToken();
  const resolvedEmail = profile?.email || firebaseUser.email || '';
  const resolvedName =
    profile?.fullName ||
    profile?.name ||
    firebaseUser.displayName ||
    resolvedEmail.split('@')[0] ||
    'User';

  return {
    user: {
      id: firebaseUser.uid,
      name: resolvedName,
      email: resolvedEmail,
      phone: profile?.phone || null,
    },
    token,
  };
};

export const signupUser = async (data: SignupPayload): Promise<AuthSession> => {
  try {
    const email = data.email.trim().toLowerCase();
    const password = data.password.trim();
    const fullName = data.fullName.trim();
    const phone = data.phone.trim();

    const credential = await auth().createUserWithEmailAndPassword(
      email,
      password
    );

    if (fullName) {
      await credential.user.updateProfile({ displayName: fullName });
    }

    const profile = await upsertUserDocument({
      uid: credential.user.uid,
      fullName,
      email,
      phone,
    });

    return buildAuthSession(credential.user, profile);
  } catch (error) {
    throw new Error(getFriendlyAuthMessage(error));
  }
};

export const loginUser = async (data: LoginPayload): Promise<AuthSession> => {
  try {
    const credential = await auth().signInWithEmailAndPassword(
      data.email.trim().toLowerCase(),
      data.password.trim()
    );

    const profile = await getUserDocument(credential.user.uid);
    return buildAuthSession(credential.user, profile);
  } catch (error) {
    throw new Error(getFriendlyAuthMessage(error));
  }
};

export const sendResetPasswordEmail = async (email: string) => {
  try {
    await auth().sendPasswordResetEmail(email.trim().toLowerCase());
  } catch (error) {
    throw new Error(getFriendlyAuthMessage(error));
  }
};

export const updateCurrentUserProfile = async ({
  fullName,
  email,
  phone,
}: UpdateProfilePayload): Promise<AuthSession> => {
  try {
    const currentUser = auth().currentUser;

    if (!currentUser) {
      throw new Error('No authenticated user found.');
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (currentUser.displayName !== trimmedName) {
      await currentUser.updateProfile({ displayName: trimmedName });
    }

    if (currentUser.email && currentUser.email.toLowerCase() !== trimmedEmail) {
      await currentUser.updateEmail(trimmedEmail);
    }

    const profile = await upsertUserDocument({
      uid: currentUser.uid,
      fullName: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
    });

    return buildAuthSession(auth().currentUser || currentUser, profile);
  } catch (error: any) {
    if (error?.code === 'auth/requires-recent-login') {
      throw new Error('For email changes, please sign in again and try once more.');
    }

    throw new Error(getFriendlyAuthMessage(error));
  }
};

export const changeCurrentUserPassword = async ({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword: string;
}) => {
  try {
    const currentUser = auth().currentUser;

    if (!currentUser?.email) {
      throw new Error('No authenticated user found.');
    }

    const credential = auth.EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );

    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(newPassword);
  } catch (error) {
    throw new Error(getFriendlyAuthMessage(error));
  }
};

export const logoutUser = async () => {
  await auth().signOut();
};

export const subscribeToAuthState = (
  callback: (session: AuthSession | null) => void
) =>
  auth().onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const profile = await getUserDocument(firebaseUser.uid);
      callback(await buildAuthSession(firebaseUser, profile));
    } catch {
      callback(await buildAuthSession(firebaseUser));
    }
  });
