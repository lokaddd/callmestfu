// app.js (type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* =========================
   ЗАМЕНИТЕ ЭТО НА СВОЙ КОНФИГ ИЗ Firebase Console -> Project settings -> SDK
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyB_7_5pRTCh8zH-pus2_G5eKzojN9Zo0dc",
  authDomain: "cheesestoregoption.firebaseapp.com",
  projectId: "cheesestoregoption",
  storageBucket: "cheesestoregoption.firebasestorage.app",
  messagingSenderId: "806041373750",
  appId: "1:806041373750:web:636e01b9773450131f9c97"
};
/* ========================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -------------------------
   Утилиты: toast, localCart handlers
   ------------------------- */
function showToast(message) {
  // простой временный toast — формируй свой UI по вкусу
  const t = document.createElement('div');
  t.textContent = message;
  t.style.position = 'fixed';
  t.style.right = '20px';
  t.style.bottom = '20px';
  t.style.padding = '10px 14px';
  t.style.background = 'rgba(0,0,0,0.85)';
  t.style.color = '#fff';
  t.style.borderRadius = '8px';
  t.style.zIndex = 9999;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 2500);
}

function getLocalCart() {
  try {
    return JSON.parse(localStorage.getItem('lubimaya_cart') || '[]');
  } catch (e) {
    return [];
  }
}
function setLocalCart(items) {
  localStorage.setItem('lubimaya_cart', JSON.stringify(items));
}

/* -------------------------
   Firestore: добавить в cart doc у пользователя
   структура: collection "carts", doc id = uid -> { userId, items: [ {id,name,price,qty} ] }
   ------------------------- */
async function addItemToFirestoreCart(user, item) {
  if (!user) throw new Error("user required");
  const cartRef = doc(db, 'carts', user.uid);
  const snap = await getDoc(cartRef);
  if (snap.exists()) {
    // добавляем/обновляем: используем простой подход — пушим элемент
    // если нужен подсчёт qty, можно сначала проверить в массиве, но проще - пушим объект и обрабатываем при оформлении
    await updateDoc(cartRef, {
      items: arrayUnion(item),
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(cartRef, {
      userId: user.uid,
      items: [item],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

/* -------------------------
   При входе пользователя — синхронизируем локальную корзину (если есть) в Firestore
   — добавляем все локальные элементы в документ carts/{uid} и очищаем localStorage
   ------------------------- */
async function migrateLocalCartToFirestore(user) {
  if (!user) return;
  const local = getLocalCart();
  if (!local || local.length === 0) return;
  const cartRef = doc(db, 'carts', user.uid);
  const snap = await getDoc(cartRef);
  if (snap.exists()) {
    // добавляем элементы по одному через arrayUnion
    for (const it of local) {
      await updateDoc(cartRef, {
        items: arrayUnion(it),
        updatedAt: serverTimestamp()
      });
    }
  } else {
    await setDoc(cartRef, {
      userId: user.uid,
      items: local,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  // очистить локальную корзину
  localStorage.removeItem('lubimaya_cart');
  showToast("Локальная корзина перенесена в аккаунт");
}

/* -------------------------
   Обработчик клика "В корзину"
   - если пользователь залогинен => добавляем в Firestore carts/{uid}
   - иначе => сохраняем в localStorage
   ------------------------- */
async function onAddToCartClick(cardEl, user) {
  const item = {
    id: cardEl.dataset.id,
    name: cardEl.dataset.name,
    price: Number(cardEl.dataset.price) || 0,
    qty: 1,
    addedAt: new Date().toISOString()
  };

  if (user) {
    try {
      await addItemToFirestoreCart(user, item);
      showToast(`${item.name} добавлен(а) в вашу корзину`);
    } catch (err) {
      console.error("add to firestore cart err", err);
      showToast("Ошибка при добавлении в корзину");
    }
  } else {
    // локальная корзина: если уже есть такой id — увеличиваем qty (упрощённо)
    const local = getLocalCart();
    const exists = local.find(x => x.id === item.id);
    if (exists) {
      exists.qty = (exists.qty || 1) + 1;
    } else {
      local.push(item);
    }
    setLocalCart(local);
    showToast(`${item.name} добавлен(а) в локальную корзину`);
  }
}

/* -------------------------
   Инициализация: вешаем обработчики на кнопки
   ------------------------- */
let currentUser = null;

function setupAddToCartButtons() {
  const buttons = document.querySelectorAll('.button-cart');
  buttons.forEach(btn => {
    // находим карточку родителя (.card)
    const card = btn.closest('.card');
    if (!card) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await onAddToCartClick(card, currentUser);
    });
  });
}

/* -------------------------
   Обновление UI: ссылка "Вход" -> "Профиль" если залогинен
   ------------------------- */
function updateAuthLinkUI(user) {
  const link = document.getElementById('auth-link');
  const linkMobile = document.getElementById('auth-link-mobile');
  if (!link) return;
  if (user) {
    link.textContent = "Профиль";
    link.href = "profile.html";
    if (linkMobile) { linkMobile.textContent = "Профиль"; linkMobile.href = "profile.html"; }
  } else {
    link.textContent = "Вход";
    link.href = "login.html";
    if (linkMobile) { linkMobile.textContent = "Вход"; linkMobile.href = "login.html"; }
  }
}

/* -------------------------
   Подписка на состояние авторизации
   ------------------------- */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateAuthLinkUI(user);
  if (user) {
    // мигрируем локальную корзину в firestore, если есть
    try {
      await migrateLocalCartToFirestore(user);
    } catch (e) {
      console.error("migrate error", e);
    }
  }
});

/* -------------------------
   Вызов инициализации на загрузке DOM
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  setupAddToCartButtons();

  // optional: кнопка "Выйти" где-нибудь в profile.html:
  // const logoutBtn = document.getElementById('logout-btn');
  // if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
});
