import { useEffect, useEffectEvent, useRef, useState } from "react";
import { loadCommentPage, mergeComments } from "./comment-pages.mjs";
import { doctorPhotoUrl } from "./doctor-photo.mjs";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { Session } from "@supabase/supabase-js";
import { Icon } from "./Art";
import { C, T, CTA, s } from "./ui";
import {
  communityPhotoUrl,
  canEditCommunityPost,
  memberDisplayName,
  normalizePost,
  POST_TOPICS,
  postWordCount,
  validComment,
  validPost,
  validTopic,
} from "./community.mjs";
import { supabase } from "./supabase";
import type { Lang } from "./types";

type Post = {
  id: string;
  public_author_id: string | null;
  is_anonymous: boolean;
  display_name: string;
  author_initials?: string;
  topic: string;
  body: string;
  image_public_id: string | null;
  created_at: string;
};
type Comment = {
  id: string;
  post_id: string;
  public_author_id: string | null;
  is_anonymous: boolean;
  parent_comment_id: string | null;
  display_name: string;
  author_initials: string;
  is_post_author: boolean;
  body: string;
  created_at: string;
};
type Doctor = {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_public_id: string | null;
};
type Photo = { uri: string; base64: string };
type Signature = {
  cloudName: string;
  apiKey: string;
  publicId: string;
  timestamp: number;
  signature: string;
};
const PAGE = 20;
const apiUrl = process.env.EXPO_PUBLIC_TUTA_API_URL?.trim().replace(/\/$/, "");
const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || "";
const topicLabels: Record<string, [string, string]> = {
  cycle: ["ციკლი", "Cycle"],
  symptoms: ["სიმპტომები", "Symptoms"],
  wellbeing: ["კეთილდღეობა", "Wellbeing"],
  nutrition: ["კვება", "Nutrition"],
  pregnancy: ["ორსულობა", "Pregnancy"],
  questions: ["კითხვები", "Questions"],
};

function friendlyDate(value: string, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(lang === "ka" ? "ka-GE" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function CommunityFeed({
  lang,
  session,
  onSignIn,
}: {
  lang: Lang;
  session: Session | null;
  onSignIn: () => void;
}) {
  const ka = lang === "ka";
  const t = (a: string, b: string) => (ka ? a : b);
  const isMember = Boolean(session && !session.user.is_anonymous);
  const [posts, setPosts] = useState<Post[]>([]),
    [loading, setLoading] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [feedError, setFeedError] = useState("");
  const [ownedPostIds, setOwnedPostIds] = useState<string[]>([]);
  const [topic, setTopic] = useState(""),
    [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [writing, setWriting] = useState(false),
    [body, setBody] = useState(""),
    [photo, setPhoto] = useState<Photo | null>(null),
    [posting, setPosting] = useState(false),
    [composerError, setComposerError] = useState(""),
    [anonymousPost, setAnonymousPost] = useState(false);
  const [comments, setComments] = useState<Record<string, Comment[]>>({}),
    [openComments, setOpenComments] = useState<Record<string, boolean>>({}),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [commentBusy, setCommentBusy] = useState<string | null>(null),
    [doctors, setDoctors] = useState<Record<string, Doctor>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({}),
    [anonymousComments, setAnonymousComments] = useState<
      Record<string, boolean>
    >({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const [commentPages, setCommentPages] = useState<
    Record<
      string,
      {
        hasMore: boolean;
        before: Comment | null;
        parents: Comment[];
        busy: boolean;
      }
    >
  >({});
  const commentRequests = useRef<Record<string, number>>({}),
    commentEpoch = useRef(0);
  useEffect(() => {
    const epoch = commentEpoch;
    epoch.current++;
    return () => {
      epoch.current++;
    };
  }, [session?.user.id]);
  const words = postWordCount(body);

  const loadDoctors = async (ids: (string | null)[]) => {
    if (!supabase || !isMember || !ids.length) return;
    const epoch = commentEpoch.current;
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return;
    const { data, error } = await supabase
      .from("verified_doctors")
      .select("user_id,first_name,last_name,photo_public_id")
      .in("user_id", unique);
    if (epoch === commentEpoch.current && !error && data)
      setDoctors((current) => {
        const next = { ...current };
        unique.forEach((id) => {
          delete next[id];
        });
        (data as Doctor[]).forEach((doctor) => {
          next[doctor.user_id] = doctor;
        });
        return next;
      });
  };

  const load = async (more = false) => {
    if (!isMember) return;
    const epoch = commentEpoch.current;
    if (!supabase) {
      setFeedError(
        t(
          "საზოგადოების ლენტი ჯერ არ არის დაკავშირებული მონაცემთა ბაზასთან.",
          "The community feed is not connected to a database yet.",
        ),
      );
      return;
    }
    if (more) setLoadingMore(true);
    else setLoading(true);
    const offset = more ? posts.length : 0;
    try {
      const client = supabase;
      const postsQuery = (fields: string) => client
        .from("community_posts")
        .select(fields)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE - 1)
        .overrideTypes<Post[], { merge: false }>();
      const baseFields = "id,public_author_id,is_anonymous,display_name,topic,body,image_public_id,created_at";
      const [result, owned] = await Promise.all([
        postsQuery(baseFields + ",author_initials"),
        supabase.from("community_post_owners").select("post_id"),
      ]);
      const { data, error } = result.error?.code === "42703"
        ? await postsQuery(baseFields)
        : result;
      if (epoch !== commentEpoch.current) return;
      if (error) throw error;
      setOwnedPostIds(
        owned.error
          ? []
          : ((owned.data || []) as { post_id: string }[]).map(
              (row) => row.post_id,
            ),
      );
      const page = data || [];
      setPosts((current) => (more ? [...current, ...page] : page));
      setHasMore(page.length === PAGE);
      setFeedError("");
      await loadDoctors(page.map((post) => post.public_author_id));
    } catch {
      if (epoch === commentEpoch.current)
        setFeedError(
          t(
            "ლენტი ვერ ჩაიტვირთა. შეამოწმე კავშირი ან მონაცემთა ბაზის გამართვა.",
            "Could not load the feed. Check your connection or database setup.",
          ),
        );
    } finally {
      if (epoch === commentEpoch.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };
  // Reload only when the signed-in member changes.
  const reloadFeed = useEffectEvent(() => void load());
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isMember) reloadFeed();
      else {
        setPosts([]);
        setOwnedPostIds([]);
        setComments({});
        setDoctors({});
        setOpenComments({});
        setWriting(false);
        setHasMore(false);
        setFeedError("");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [lang, isMember, session?.user.id]);

  const loadComments = async (postId: string, older = false) => {
    if (!supabase || !isMember) return;
    const epoch = commentEpoch.current,
      turn = (commentRequests.current[postId] || 0) + 1;
    commentRequests.current[postId] = turn;
    setCommentPages((current) => ({
      ...current,
      [postId]: { ...current[postId], busy: true },
    }));
    try {
      const page = await loadCommentPage(
        supabase,
        postId,
        older ? commentPages[postId]?.before : null,
      );
      if (
        epoch !== commentEpoch.current ||
        commentRequests.current[postId] !== turn
      )
        return;
      setComments((current) => ({
        ...current,
        [postId]: mergeComments(
          older ? current[postId] || [] : [],
          page.comments,
        ),
      }));
      setCommentPages((current) => ({
        ...current,
        [postId]: {
          ...page,
          parents: mergeComments(
            older ? current[postId]?.parents || [] : [],
            page.parents,
          ),
          busy: false,
        },
      }));
      await loadDoctors(
        [...page.comments, ...page.parents].map(
          (comment) => comment.public_author_id,
        ),
      );
    } catch {
      if (
        epoch === commentEpoch.current &&
        commentRequests.current[postId] === turn
      ) {
        setNotice(t("კომენტარები ვერ ჩაიტვირთა.", "Could not load comments."));
        setCommentPages((current) => ({
          ...current,
          [postId]: { ...current[postId], busy: false },
        }));
      }
    }
  };

  const toggleComments = (postId: string) => {
    if (!openComments[postId]) void loadComments(postId);
    setOpenComments((current) => ({ ...current, [postId]: !current[postId] }));
  };

  const addComment = async (post: Post) => {
    if (!supabase || !session) {
      onSignIn();
      return;
    }
    const postId = post.id;
    const text = normalizePost(drafts[postId] || "");
    if (!validComment(text)) {
      setNotice(
        t(
          "კომენტარი უნდა შეიცავდეს 1–1000 სიმბოლოს.",
          "Comments must be 1–1000 characters.",
        ),
      );
      return;
    }
    setCommentBusy(postId);
    const anonymous =
      post.is_anonymous &&
      ownedPostIds.includes(postId) &&
      (anonymousComments[postId] ?? true);
    const { error } = await supabase.from("community_comments").insert({
      post_id: postId,
      parent_comment_id: replyTo[postId] || null,
      author_id: session.user.id,
      display_name: anonymous
        ? "Anonymous"
        : memberDisplayName(session.user.user_metadata),
      is_anonymous: anonymous,
      body: text,
    });
    if (error)
      setNotice(
        t("კომენტარი ვერ გამოქვეყნდა.", "Could not publish the comment."),
      );
    else {
      setDrafts((current) => ({ ...current, [postId]: "" }));
      setReplyTo((current) => ({ ...current, [postId]: null }));
      await loadComments(postId);
    }
    setCommentBusy(null);
  };

  const startEdit = (post: Post) => {
    if (
      !ownedPostIds.includes(post.id) ||
      !canEditCommunityPost(post.created_at, true, now)
    ) {
      setNotice(
        t(
          "პოსტის რედაქტირების 30-წუთიანი ვადა ამოიწურა.",
          "The 30-minute post editing window has expired.",
        ),
      );
      return;
    }
    setEditingId(post.id);
    setBody(post.body);
    setTopic(post.topic);
    setAnonymousPost(post.is_anonymous);
    setPhoto(null);
    setComposerError("");
    setWriting(true);
  };
  const removePost = (post: Post) =>
    Alert.alert(
      t("პოსტის წაშლა", "Delete post"),
      t(
        "პოსტი და მისი კომენტარები წაიშლება.",
        "The post and its comments will be deleted.",
      ),
      [
        { text: t("გაუქმება", "Cancel"), style: "cancel" },
        {
          text: t("წაშლა", "Delete"),
          style: "destructive",
          onPress: () => {
            if (!supabase || !session || !ownedPostIds.includes(post.id))
              return;
            void supabase
              .from("community_posts")
              .delete()
              .eq("id", post.id)
              .select("id")
              .maybeSingle()
              .then(({ data, error }) => {
                setNotice(
                  error || !data
                    ? t("პოსტი ვერ წაიშალა.", "Could not delete the post.")
                    : t("პოსტი წაიშალა.", "Post deleted."),
                );
                if (data && !error) void load();
              });
          },
        },
      ],
    );

  const pickPhoto = async () => {
    setComposerError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        setComposerError(
          t(
            "ფოტო ვერ წავიკითხეთ. სცადე სხვა ფოტო.",
            "Could not read this photo. Try another one.",
          ),
        );
        return;
      }
      const bytes = Math.ceil((asset.base64.length * 3) / 4);
      if (bytes > 4 * 1024 * 1024) {
        setComposerError(
          t(
            "ფოტო 4 მბ-ზე პატარა უნდა იყოს.",
            "The photo must be smaller than 4 MB.",
          ),
        );
        return;
      }
      setPhoto({ uri: asset.uri, base64: asset.base64 });
    } catch {
      setComposerError(
        t("ფოტოს არჩევა ვერ მოხერხდა.", "Could not select a photo."),
      );
    }
  };

  const publish = async () => {
    if (!supabase || !session) {
      onSignIn();
      return;
    }
    if (!validPost(body)) {
      setComposerError(
        t(
          "დაწერე ტექსტი მაქსიმუმ 200 სიტყვით.",
          "Write a post of at most 200 words.",
        ),
      );
      return;
    }
    if (!validTopic(topic)) {
      setComposerError(
        t("აირჩიე პოსტის თემა.", "Choose a topic for your post."),
      );
      return;
    }
    if (editingId) {
      const original = posts.find((post) => post.id === editingId);
      if (
        !original ||
        !ownedPostIds.includes(editingId) ||
        !canEditCommunityPost(original.created_at, true, now)
      ) {
        setEditingId(null);
        setWriting(false);
        setComposerError(
          t(
            "პოსტის რედაქტირების 30-წუთიანი ვადა ამოიწურა.",
            "The 30-minute post editing window has expired.",
          ),
        );
        return;
      }
      setPosting(true);
      setComposerError("");
      const { data, error } = await supabase
        .from("community_posts")
        .update({ body: normalizePost(body), topic })
        .eq("id", editingId)
        .select("id")
        .maybeSingle();
      if (error || !data)
        setComposerError(
          t("პოსტი ვერ დარედაქტირდა.", "Could not edit the post."),
        );
      else {
        setWriting(false);
        setEditingId(null);
        setBody("");
        setTopic("");
        setNotice(t("პოსტი განახლდა.", "Post updated."));
        await load();
      }
      setPosting(false);
      return;
    }
    if (photo && (!apiUrl || !cloudName)) {
      setComposerError(
        t(
          "ფოტოების სერვისი ჯერ არ არის გამართული. შესაძლებელია მხოლოდ ტექსტის გამოქვეყნება.",
          "Photo uploads are not configured yet. You can publish text only.",
        ),
      );
      return;
    }
    setPosting(true);
    setComposerError("");
    try {
      let image_public_id: string | null = null;
      if (photo) {
        const signed = await fetch(
          `${apiUrl}/api/community/cloudinary-signature`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ anonymous: anonymousPost }),
          },
        );
        if (!signed.ok) throw new Error("signature");
        const details = (await signed.json()) as Signature;
        if (
          details.cloudName !== cloudName ||
          !details.publicId.startsWith(
            `tuta-community/${anonymousPost ? "anon" : session.user.id}/`,
          )
        )
          throw new Error("signature");
        const upload = new FormData();
        upload.append("file", `data:image/jpeg;base64,${photo.base64}`);
        upload.append("api_key", details.apiKey);
        upload.append("timestamp", String(details.timestamp));
        upload.append("public_id", details.publicId);
        upload.append("signature", details.signature);
        const uploaded = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
          { method: "POST", body: upload },
        );
        if (!uploaded.ok) throw new Error("upload");
        const asset = (await uploaded.json()) as { public_id?: string };
        if (asset.public_id !== details.publicId) throw new Error("upload");
        image_public_id = details.publicId;
      }
      const display_name = memberDisplayName(session.user.user_metadata);
      const { error } = await supabase.from("community_posts").insert({
        author_id: session.user.id,
        display_name: anonymousPost ? "Anonymous" : display_name,
        is_anonymous: anonymousPost,
        topic,
        body: normalizePost(body),
        image_public_id,
      });
      if (error) throw error;
      setBody("");
      setTopic("");
      setPhoto(null);
      setWriting(false);
      setNotice(t("პოსტი გამოქვეყნდა.", "Post published."));
      await load();
    } catch {
      setComposerError(
        t(
          "პოსტი ვერ გამოქვეყნდა. შეამოწმე კავშირი და სცადე ხელახლა.",
          "Could not publish the post. Check your connection and try again.",
        ),
      );
    } finally {
      setPosting(false);
    }
  };

  const report = async (postId: string, reason: string) => {
    if (!supabase || !session) {
      onSignIn();
      return;
    }
    const { error } = await supabase
      .from("community_reports")
      .insert({ post_id: postId, reporter_id: session.user.id, reason });
    setNotice(
      error
        ? t(
            "შეტყობინება ვერ გაიგზავნა ან უკვე გაგზავნილია.",
            "Report could not be sent or was already submitted.",
          )
        : t(
            "მადლობა. პოსტი შემოწმებისთვის მოინიშნა.",
            "Thank you. The post was flagged for review.",
          ),
    );
  };
  const reportMenu = (postId: string) =>
    Alert.alert(
      t("პოსტის მონიშვნა", "Report post"),
      t("აირჩიე მიზეზი", "Choose a reason"),
      [
        {
          text: t("სპამი", "Spam"),
          onPress: () => void report(postId, "spam"),
        },
        {
          text: t("შეურაცხყოფა", "Abuse"),
          onPress: () => void report(postId, "abuse"),
        },
        {
          text: t("პირადი მონაცემები", "Privacy"),
          onPress: () => void report(postId, "privacy"),
        },
        {
          text: t("სამედიცინო შეცდომა", "Medical misinformation"),
          onPress: () => void report(postId, "medical_misinformation"),
        },
        { text: t("გაუქმება", "Cancel"), style: "cancel" },
      ],
    );

  if (!isMember)
    return (
      <View style={s.content}>
        <View style={{ marginBottom: 17 }}>
          <T style={[s.muted, { fontSize: 14 }]}>
            {t("თუთას საზოგადოება", "TUTA COMMUNITY")}
          </T>
          <T
            weight="display"
            style={[s.title, { marginTop: 4, marginBottom: 7 }]}
          >
            {t("ერთად, საკუთარ რიტმში.", "A space to share.")}
          </T>
        </View>
        <View style={s.card}>
          <T weight="bold" style={{ fontSize: 21 }}>
            {t("შედი საზოგადოების სანახავად", "Sign in to view the community")}
          </T>
          <T style={[s.muted, { marginTop: 10, marginBottom: 20 }]}>
            {t(
              "პოსტებისა და კომენტარების ნახვა მხოლოდ რეგისტრირებულ მომხმარებლებს შეუძლიათ.",
              "Only registered members can view posts and comments.",
            )}
          </T>
          <CTA
            title={t("შესვლა ან რეგისტრაცია", "Sign in or register")}
            onPress={onSignIn}
          />
        </View>
      </View>
    );

  return (
    <View style={s.content}>
      <View style={{ marginBottom: 17 }}>
        <T style={[s.muted, { fontSize: 14 }]}>
          {t("თუთას საზოგადოება", "TUTA COMMUNITY")}
        </T>
        <T
          weight="display"
          style={[s.title, { marginTop: 4, marginBottom: 7 }]}
        >
          {t("ერთად, საკუთარ რიტმში.", "A space to share.")}
        </T>
        <T style={s.muted}>
          {t(
            "გაუზიარე გამოცდილება სხვებს. შენი ციკლის ჩანაწერები აქ არ გამოჩნდება.",
            "Share your experience. Your private cycle entries never appear here.",
          )}
        </T>
      </View>

      <View style={s.card}>
        <View style={[s.row, { gap: 12 }]}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: C.yellow,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="profile" size={21} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingId(null);
              setBody("");
              setTopic("");
              setAnonymousPost(false);
              setPhoto(null);
              setWriting(true);
            }}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 18,
              backgroundColor: C.bg,
              paddingHorizontal: 16,
              justifyContent: "center",
            }}
          >
            <T style={s.muted}>
              {t("რას გაუზიარებ სხვებს?", "What would you like to share?")}
            </T>
          </Pressable>
        </View>
        <T style={[s.muted, { marginTop: 12 }]}>
          {t(
            "მაქს. 200 სიტყვა · 1 ფოტო · აირჩიე თემა",
            "200 words max · 1 photo · choose a topic",
          )}
        </T>
      </View>

      {writing && (
        <View style={[s.card, { borderColor: "#B6A1CF" }]}>
          <T weight="bold" style={{ fontSize: 19, marginBottom: 12 }}>
            {editingId
              ? t("პოსტის რედაქტირება", "Edit post")
              : t("ახალი პოსტი", "New post")}
          </T>
          <T style={[s.muted, { marginBottom: 12 }]}>
            {t(
              "პოსტი რეგისტრირებულ მომხმარებლებს გამოუჩნდებათ. არ გამოაქვეყნო პირადი ჯანმრთელობის მონაცემები.",
              "Registered members can see this post. Avoid sharing private health details.",
            )}
          </T>
          {!editingId ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: anonymousPost }}
              onPress={() => setAnonymousPost((current) => !current)}
              style={[s.row, { minHeight: 48, marginBottom: 12 }]}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: C.ink,
                  backgroundColor: anonymousPost ? C.lav : C.white,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T>{anonymousPost ? "✓" : ""}</T>
              </View>
              <T weight="bold">
                {t("ანონიმურად გამოქვეყნება", "Post anonymously")}
              </T>
            </Pressable>
          ) : (
            <T style={[s.muted, { marginBottom: 12 }]}>
              {anonymousPost
                ? t("ეს პოსტი ანონიმურია", "This post is anonymous")
                : t("ეს პოსტი შენი სახელითაა", "This post uses your name")}
            </T>
          )}
          <T weight="bold" style={{ marginBottom: 8 }}>
            {t("რას ეხება პოსტი?", "What is this post about?")}
          </T>
          <View style={[s.wrap, { marginBottom: 15 }]}>
            {POST_TOPICS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: topic === key }}
                onPress={() => setTopic(key)}
                style={[
                  s.chip,
                  { backgroundColor: topic === key ? C.lav : C.white },
                ]}
              >
                <T weight={topic === key ? "bold" : "regular"}>
                  {t(...topicLabels[key])}
                </T>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel={t("პოსტის ტექსტი", "Post text")}
            multiline
            textAlignVertical="top"
            placeholder={t(
              "დაწერე შენი გამოცდილება…",
              "Share your experience…",
            )}
            placeholderTextColor={C.muted}
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            style={[s.input, { minHeight: 150 }]}
          />
          <T
            style={[
              s.muted,
              {
                textAlign: "right",
                marginTop: 6,
                color: words > 200 ? "#92384B" : C.muted,
              },
            ]}
          >
            {words}/200 {t("სიტყვა", "words")}
          </T>
          {photo && (
            <View style={{ marginTop: 12 }}>
              <Image
                source={{ uri: photo.uri }}
                resizeMode="cover"
                style={{ width: "100%", height: 220, borderRadius: 15 }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setPhoto(null)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T weight="bold">{t("ფოტოს წაშლა", "Remove photo")}</T>
              </Pressable>
            </View>
          )}
          <View
            style={[
              s.wrap,
              { justifyContent: "space-between", marginVertical: 12 },
            ]}
          >
            {!editingId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void pickPhoto()}
                style={[s.chip, s.row]}
              >
                <Icon name="image" size={20} />
                <T weight="bold" style={{ flexShrink: 1 }}>
                  {photo
                    ? t("ფოტოს შეცვლა", "Change photo")
                    : t("ფოტოს დამატება", "Add photo")}
                </T>
              </Pressable>
            ) : (
              <T style={s.muted}>
                {t("ფოტო უცვლელი დარჩება", "Photo stays unchanged")}
              </T>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setWriting(false);
                setEditingId(null);
                setBody("");
                setTopic("");
                setPhoto(null);
                setComposerError("");
              }}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <T>{t("დახურვა", "Close")}</T>
            </Pressable>
          </View>
          {composerError ? (
            <T accessibilityRole="alert" style={s.error}>
              {composerError}
            </T>
          ) : null}
          <CTA
            title={
              posting
                ? t("ინახება…", "Saving…")
                : editingId
                  ? t("ცვლილებების შენახვა", "Save changes")
                  : t("გამოქვეყნება", "Publish post")
            }
            disabled={posting || !validPost(body) || !validTopic(topic)}
            onPress={() => void publish()}
          />
        </View>
      )}

      {notice ? (
        <View style={s.banner}>
          <T accessibilityLiveRegion="polite">{notice}</T>
        </View>
      ) : null}
      <View
        style={[
          s.wrap,
          {
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 12,
          },
        ]}
      >
        <T weight="bold" style={{ fontSize: 20, flexGrow: 1, flexBasis: 165 }}>
          {t("საზოგადოების პოსტები", "Community posts")}
        </T>
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={{ minHeight: 44, justifyContent: "center", flexShrink: 0 }}
        >
          <T weight="bold">{t("განახლება", "Refresh")}</T>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={C.ink} style={{ marginVertical: 30 }} />
      ) : null}
      {feedError ? (
        <View style={s.banner}>
          <T>{feedError}</T>
        </View>
      ) : null}
      {!loading && !feedError && posts.length === 0 ? (
        <View style={s.card}>
          <T weight="bold">{t("ჯერ პოსტები არ არის", "No posts yet")}</T>
          <T style={[s.muted, { marginTop: 6 }]}>
            {t(
              "პირველი პოსტი შეგიძლია შენ დაწერო.",
              "You can write the first one.",
            )}
          </T>
        </View>
      ) : null}
      {posts.map((post) => {
        const uri = post.image_public_id
          ? communityPhotoUrl(cloudName, post.image_public_id)
          : null;
        const doctor = post.public_author_id
          ? doctors[post.public_author_id]
          : undefined;
        const avatar = doctorPhotoUrl(cloudName, doctor, post.is_anonymous);
        const name = post.is_anonymous
          ? t("ანონიმური", "Anonymous")
          : doctor
            ? `${t("ექიმი", "Dr.")} ${doctor.first_name} ${doctor.last_name}`
            : post.author_initials && post.author_initials !== "?"
              ? post.author_initials
              : post.display_name !== "Member"
                ? Array.from(post.display_name.trim())[0] || "?"
                : "?";
        return (
          <View key={post.id} style={s.card}>
            <View style={[s.row, { marginBottom: 12 }]}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: C.lav,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatar ? (
                  <Image
                    source={{ uri: avatar }}
                    accessibilityLabel={name}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                ) : (
                  <T weight="bold">{post.is_anonymous ? "?" : post.author_initials || "?"}</T>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <T weight="bold">
                  {name}
                  {doctor && !post.is_anonymous ? " ✓" : ""}
                </T>
                <T style={s.muted}>
                  {friendlyDate(post.created_at, lang)} ·{" "}
                  {topicLabels[post.topic]
                    ? t(...topicLabels[post.topic])
                    : post.topic}
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("პოსტის მონიშვნა", "Report post")}
                onPress={() => reportMenu(post.id)}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="more" />
              </Pressable>
            </View>
            <T style={{ lineHeight: 25 }}>{post.body}</T>
            {uri ? (
              <Image
                source={{ uri }}
                resizeMode="cover"
                style={{
                  width: "100%",
                  height: 260,
                  borderRadius: 16,
                  marginTop: 15,
                }}
              />
            ) : post.image_public_id ? (
              <T style={[s.muted, { marginTop: 10 }]}>
                {t("ფოტო მიუწვდომელია", "Photo unavailable")}
              </T>
            ) : null}
            <View style={[s.row, { flexWrap: "wrap", marginTop: 12 }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => toggleComments(post.id)}
                style={s.chip}
              >
                <T weight="bold">
                  {openComments[post.id]
                    ? t("კომენტარების დამალვა", "Hide comments")
                    : t("კომენტარები", "Comments")}
                </T>
              </Pressable>
              {ownedPostIds.includes(post.id) ? (
                <>
                  {canEditCommunityPost(post.created_at, true, now) ? <Pressable
                    accessibilityRole="button"
                    onPress={() => startEdit(post)}
                    style={s.chip}
                  >
                    <T>{t("რედაქტირება", "Edit")}</T>
                  </Pressable> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removePost(post)}
                    style={s.chip}
                  >
                    <T style={{ color: "#92384B" }}>{t("წაშლა", "Delete")}</T>
                  </Pressable>
                </>
              ) : null}
            </View>
            {openComments[post.id] ? (
              <View
                style={{
                  marginTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: C.line,
                  paddingTop: 12,
                }}
              >
                {commentPages[post.id]?.busy && (
                  <ActivityIndicator color={C.ink} />
                )}
                {commentPages[post.id]?.hasMore && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={commentPages[post.id]?.busy}
                    onPress={() => void loadComments(post.id, true)}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <T weight="bold">
                      {t("წინა კომენტარების ნახვა", "Load older comments")}
                    </T>
                  </Pressable>
                )}
                {(comments[post.id] || []).map((comment) => {
                  const commentDoctor = comment.public_author_id
                    ? doctors[comment.public_author_id]
                    : undefined;
                  const commentName = comment.is_anonymous
                    ? t("ანონიმური", "Anonymous")
                    : commentDoctor
                      ? `${t("ექიმი", "Dr.")} ${commentDoctor.first_name} ${commentDoctor.last_name}`
                      : comment.display_name === "Member"
                        ? comment.author_initials || "?"
                        : comment.display_name;
                  const commentAvatar = doctorPhotoUrl(
                    cloudName,
                    commentDoctor,
                    comment.is_anonymous,
                  );
                  const parent = [
                    ...(comments[post.id] || []),
                    ...(commentPages[post.id]?.parents || []),
                  ].find((item) => item.id === comment.parent_comment_id);
                  return (
                    <View
                      key={comment.id}
                      style={{
                        marginBottom: 13,
                        marginLeft: comment.parent_comment_id ? 18 : 0,
                        paddingLeft: comment.parent_comment_id ? 10 : 0,
                        borderLeftWidth: comment.parent_comment_id ? 2 : 0,
                        borderLeftColor: C.lav,
                      }}
                    >
                      {parent ? (
                        <T style={s.muted}>
                          {t("პასუხი კომენტარზე", "Reply to")}{" "}
                          {parent.is_anonymous
                            ? t("ანონიმური", "Anonymous")
                            : parent.display_name === "Member"
                              ? parent.author_initials || "?"
                              : parent.display_name}
                        </T>
                      ) : null}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 5,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: C.lav,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {commentAvatar ? (
                            <Image
                              source={{ uri: commentAvatar }}
                              accessibilityLabel={commentName}
                              style={{ width: 36, height: 36 }}
                            />
                          ) : (
                            <T weight="bold">
                              {comment.is_anonymous
                                ? "?"
                                : comment.author_initials || "?"}
                            </T>
                          )}
                        </View>
                        <T weight="bold">
                          {commentName}
                          {commentDoctor && !comment.is_anonymous ? " ✓" : ""}
                        </T>
                      </View>
                      {comment.is_post_author ||
                      (!post.is_anonymous && !comment.is_anonymous &&
                        post.public_author_id && post.public_author_id === comment.public_author_id) ? (
                        <T
                          accessibilityLabel={t("პოსტის ავტორი", "Post author")}
                          style={{ color: C.ink, backgroundColor: "#FDF0CC", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: "flex-start", marginTop: 4 }}
                        >
                          {t("პოსტის ავტორი", "Post author")}
                        </T>
                      ) : null}
                      <T style={s.muted}>
                        {friendlyDate(comment.created_at, lang)}
                      </T>
                      <T style={{ marginTop: 3 }}>{comment.body}</T>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          setReplyTo((current) => ({
                            ...current,
                            [post.id]: comment.id,
                          }))
                        }
                        style={{
                          minHeight: 44,
                          justifyContent: "center",
                          alignSelf: "flex-start",
                        }}
                      >
                        <T weight="bold" style={{ color: "#5E4780" }}>
                          {t("პასუხი", "Reply")}
                        </T>
                      </Pressable>
                    </View>
                  );
                })}
                {replyTo[post.id] ? (
                  <View style={[s.wrap, { marginBottom: 8, alignItems: "center" }]}>
                    <T style={s.muted}>
                      {t("პასუხობ კომენტარს", "Replying to comment")}
                    </T>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setReplyTo((current) => ({
                          ...current,
                          [post.id]: null,
                        }))
                      }
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <T weight="bold">{t("გაუქმება", "Cancel")}</T>
                    </Pressable>
                  </View>
                ) : null}
                <TextInput
                  accessibilityLabel={t("კომენტარი", "Comment")}
                  placeholder={
                    replyTo[post.id]
                      ? t("დაწერე პასუხი…", "Write a reply…")
                      : t("დაწერე კომენტარი…", "Write a comment…")
                  }
                  placeholderTextColor={C.muted}
                  value={drafts[post.id] || ""}
                  onChangeText={(value) =>
                    setDrafts((current) => ({ ...current, [post.id]: value }))
                  }
                  maxLength={1000}
                  multiline
                  style={s.input}
                />
                {post.is_anonymous && ownedPostIds.includes(post.id) ? (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: anonymousComments[post.id] ?? true,
                    }}
                    onPress={() =>
                      setAnonymousComments((current) => ({
                        ...current,
                        [post.id]: !(current[post.id] ?? true),
                      }))
                    }
                    style={[s.row, { minHeight: 48, marginTop: 8 }]}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: C.ink,
                        backgroundColor:
                          (anonymousComments[post.id] ?? true)
                            ? C.lav
                            : C.white,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <T>{(anonymousComments[post.id] ?? true) ? "✓" : ""}</T>
                    </View>
                    <T>{t("ანონიმურად პასუხი", "Reply anonymously")}</T>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    commentBusy === post.id ||
                    !validComment(drafts[post.id] || "")
                  }
                  onPress={() => void addComment(post)}
                  style={[
                    s.chip,
                    {
                      alignSelf: "flex-start",
                      marginTop: 8,
                      opacity: commentBusy === post.id ? 0.5 : 1,
                    },
                  ]}
                >
                  <T weight="bold">
                    {replyTo[post.id]
                      ? t("პასუხის გაგზავნა", "Post reply")
                      : t("კომენტარის გაგზავნა", "Post comment")}
                  </T>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      {hasMore && !loading ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void load(true)}
          disabled={loadingMore}
          style={[s.chip, { alignItems: "center" }]}
        >
          <T weight="bold">
            {loadingMore
              ? t("იტვირთება…", "Loading…")
              : t("მეტი პოსტის ნახვა", "Load more posts")}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
