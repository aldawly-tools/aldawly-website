import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  addDoc, collection, getFirestore, onSnapshot, query, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

(function () {
  const root = document.getElementById("productDetail");
  if (!root) return;
  const productId = new URLSearchParams(location.search).get("id");
  if (!productId) return;
  const config = window.DAWLY_FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId) return;

  const app = getApps().length ? getApp() : initializeApp(config);
  const db = getFirestore(app);
  const reviewsRef = collection(db, "productReviews", String(productId), "reviews");
  const section = document.createElement("section");
  section.className = "product-reviews";
  section.innerHTML = `
    <div class="reviews-heading"><div><h2>تقييمات العملاء</h2><p>شاركنا رأيك في المنتج ليستفيد باقي العملاء</p></div><div class="reviews-summary" id="reviewsSummary">لا توجد تقييمات بعد</div></div>
    <div class="reviews-list" id="reviewsList"><p class="reviews-empty">جارٍ تحميل التقييمات…</p></div>
    <form class="review-form" id="reviewForm">
      <h3>أضف تقييمك</h3>
      <label for="reviewName">اسمك (اختياري)</label><input id="reviewName" maxlength="40" placeholder="اكتب اسمك">
      <label>تقييمك</label><div class="review-stars" role="radiogroup" aria-label="اختر عدد النجوم">
        ${[1,2,3,4,5].map(n => `<button type="button" class="review-star" data-rating="${n}" aria-label="${n} نجوم" aria-pressed="false">★</button>`).join("")}
      </div>
      <label for="reviewText">تعليقك (اختياري)</label><textarea id="reviewText" maxlength="500" rows="3" placeholder="اكتب تجربتك مع المنتج"></textarea>
      <button class="button-primary" type="submit" id="submitReview" disabled>إرسال التقييم</button>
      <p class="review-status" id="reviewStatus" aria-live="polite">اختر عدد النجوم أولًا. التقييمات عامة وغير مرتبطة بعملية شراء مؤكدة.</p>
    </form>`;
  root.appendChild(section);

  let selectedRating = 0;
  const stars = section.querySelectorAll("[data-rating]");
  const form = section.querySelector("#reviewForm");
  const submit = section.querySelector("#submitReview");
  const status = section.querySelector("#reviewStatus");
  const list = section.querySelector("#reviewsList");
  const summary = section.querySelector("#reviewsSummary");
  stars.forEach(button => button.addEventListener("click", () => {
    selectedRating = Number(button.dataset.rating);
    stars.forEach(star => {
      const active = Number(star.dataset.rating) <= selectedRating;
      star.classList.toggle("active", active);
      star.setAttribute("aria-pressed", String(Number(star.dataset.rating) === selectedRating));
    });
    submit.disabled = false;
  }));

  function safe(value) {
    return String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function renderReviews(items) {
    if (!items.length) {
      summary.textContent = "لا توجد تقييمات بعد";
      list.innerHTML = '<p class="reviews-empty">كن أول من يقيّم هذا المنتج ⭐</p>';
      return;
    }
    const average = items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length;
    summary.innerHTML = '<strong>' + average.toFixed(1) + ' ★</strong><span>' + items.length + ' تقييم</span>';
    list.innerHTML = items.slice(0, 30).map(item =>
      '<article class="review-item"><div class="review-item-head"><strong>' + safe(item.name || "عميل") + '</strong><span class="review-item-stars">' + "★".repeat(Math.max(0, Math.min(5, Number(item.rating) || 0))) + '</span></div>' +
      (item.text ? '<p>' + safe(item.text) + '</p>' : '') + '</article>'
    ).join("");
  }

  onSnapshot(reviewsRef, snapshot => {
    const items = snapshot.docs.map(doc => doc.data());
    items.sort((a,b) => {
      const ta = a.createdAt && a.createdAt.seconds || 0;
      const tb = b.createdAt && b.createdAt.seconds || 0;
      return tb - ta;
    });
    renderReviews(items);
  }, error => {
    console.warn("Reviews could not be loaded:", error);
    list.innerHTML = '<p class="reviews-empty">تعذر تحميل التقييمات حاليًا.</p>';
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selectedRating) return;
    submit.disabled = true;
    status.textContent = "جارٍ إرسال تقييمك…";
    const name = form.querySelector("#reviewName").value.trim().slice(0,40);
    const text = form.querySelector("#reviewText").value.trim().slice(0,500);
    try {
      await addDoc(reviewsRef, {rating:selectedRating, name, text, createdAt:serverTimestamp()});
      form.reset();
      selectedRating = 0;
      stars.forEach(star => { star.classList.remove("active"); star.setAttribute("aria-pressed","false"); });
      status.textContent = "شكرًا لك، تم إرسال تقييمك.";
    } catch (error) {
      console.error("Review submission failed:", error);
      status.textContent = "تعذر إرسال التقييم. يلزم تفعيل قواعد تقييمات العملاء في Firebase أولًا.";
      submit.disabled = false;
    }
  });
})();