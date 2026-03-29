import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user) {
      console.log("[Auth] User authenticated, redirecting to tabs");
      router.replace("/(tabs)");
    }
  }, [user]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (isSignUp && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setSubmitting(true);
    console.log(`[Auth] Attempting ${isSignUp ? "sign up" : "sign in"} with email: ${email}`);
    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password, name.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      console.error("[Auth] Email auth error:", err);
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    console.log("[Auth] Tapped Sign in with Apple");
    setSocialLoading("apple");
    setError("");
    try {
      await signInWithApple();
    } catch (err: any) {
      if (!err?.message?.includes("cancel")) {
        setError(err?.message || "Apple sign in failed");
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    console.log("[Auth] Tapped Sign in with Google");
    setSocialLoading("google");
    setError("");
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || "Google sign in failed");
    } finally {
      setSocialLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🌙⭐</Text>
            <Text style={styles.appName}>Daily Tracker</Text>
            <Text style={styles.tagline}>Track your day, every day! ⭐</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? "Create Account" : "Welcome Back!"}</Text>

            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex"
                  placeholderTextColor={COLORS.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. alex@email.com"
                placeholderTextColor={COLORS.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={COLORS.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleEmailAuth}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <AnimatedPressable
              onPress={handleEmailAuth}
              disabled={submitting}
              style={styles.primaryBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isSignUp ? "Create Account 🚀" : "Sign In ✨"}
                </Text>
              )}
            </AnimatedPressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Apple first (App Store requirement) */}
            <AnimatedPressable
              onPress={handleApple}
              disabled={socialLoading !== null}
              style={styles.appleBtn}
            >
              {socialLoading === "apple" ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.appleBtnText}> Sign in with Apple</Text>
              )}
            </AnimatedPressable>

            <AnimatedPressable
              onPress={handleGoogle}
              disabled={socialLoading !== null}
              style={styles.googleBtn}
            >
              {socialLoading === "google" ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Text style={styles.googleBtnText}>🌐 Sign in with Google</Text>
              )}
            </AnimatedPressable>
          </View>

          {/* Toggle */}
          <Pressable
            onPress={() => {
              console.log(`[Auth] Toggled to ${!isSignUp ? "sign up" : "sign in"}`);
              setIsSignUp(!isSignUp);
              setError("");
            }}
            style={styles.toggleBtn}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? "Already have an account? " : "New here? "}
              <Text style={styles.toggleLink}>{isSignUp ? "Sign In" : "Create Account"}</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    gap: 20,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  emoji: {
    fontSize: 56,
    lineHeight: 68,
  },
  appName: {
    fontSize: 34,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    boxShadow: "0 2px 16px rgba(108, 99, 255, 0.08)",
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorBox: {
    backgroundColor: "rgba(244, 67, 54, 0.08)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.2)",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textTertiary,
  },
  appleBtn: {
    backgroundColor: "#000",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  appleBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
  googleBtn: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
  toggleBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.textSecondary,
  },
  toggleLink: {
    color: COLORS.primary,
    fontFamily: "Nunito_700Bold",
  },
});
