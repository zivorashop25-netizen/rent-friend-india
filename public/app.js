/* =========================
   RENT FRIEND INDIA
   MAIN JAVASCRIPT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadPaymentInfo();
  loadMyAccount();

  const registerForm =
    document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      registerUser
    );
  }

  const loginForm =
    document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }
});


/* =========================
   MOBILE MENU
========================= */

function toggleMenu() {
  const menu =
    document.getElementById("navMenu");

  if (menu) {
    menu.classList.toggle("active");
  }
}


/* =========================
   REGISTER
========================= */

async function registerUser(event) {

  event.preventDefault();

  const message =
    document.getElementById(
      "registerMessage"
    );

  message.textContent =
    "Creating your account...";

  try {

    const data = {

      name:
        document.getElementById(
          "regName"
        ).value.trim(),

      email:
        document.getElementById(
          "regEmail"
        ).value.trim(),

      password:
        document.getElementById(
          "regPassword"
        ).value,

      phone:
        document.getElementById(
          "regPhone"
        ).value.trim(),

      age:
        document.getElementById(
          "regAge"
        ).value,

      city:
        document.getElementById(
          "regCity"
        ).value.trim(),

      gender:
        document.getElementById(
          "regGender"
        ).value,

      bio:
        document.getElementById(
          "regBio"
        ).value.trim()
    };

    const response =
      await fetch("/api/register", {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(data)
      });

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "Registration failed"
      );
    }

    message.textContent =
      "Account created successfully. Please login.";

    message.style.color =
      "#198754";

    document
      .getElementById("registerForm")
      .reset();

    setTimeout(() => {

      document
        .getElementById("login")
        ?.scrollIntoView({
          behavior: "smooth"
        });

    }, 800);

  } catch (error) {

    message.textContent =
      error.message;

    message.style.color =
      "#b42318";
  }
}


/* =========================
   LOGIN
========================= */

async function loginUser(event) {

  event.preventDefault();

  const message =
    document.getElementById(
      "loginMessage"
    );

  message.textContent =
    "Logging in...";

  try {

    const email =
      document.getElementById(
        "loginEmail"
      ).value.trim();

    const password =
      document.getElementById(
        "loginPassword"
      ).value;

    const response =
      await fetch("/api/login", {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          email,
          password
        })
      });

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "Login failed"
      );
    }

    message.textContent =
      "Login successful!";

    message.style.color =
      "#198754";

    document
      .getElementById("loginForm")
      .reset();

    await loadMyAccount();

    setTimeout(() => {

      document
        .querySelector(
          ".dashboard-section"
        )
        ?.scrollIntoView({
          behavior: "smooth"
        });

    }, 500);

  } catch (error) {

    message.textContent =
      error.message;

    message.style.color =
      "#b42318";
  }
}


/* =========================
   LOAD PROFILES
========================= */

async function loadProfiles() {

  const grid =
    document.getElementById(
      "profilesGrid"
    );

  if (!grid) return;

  grid.innerHTML = `
    <div class="empty-state">
      <p>Loading profiles...</p>
    </div>
  `;

  try {

    const city =
      document.getElementById(
        "citySearch"
      )?.value.trim() || "";

    const gender =
      document.getElementById(
        "genderSearch"
      )?.value || "";

    const params =
      new URLSearchParams();

    if (city) {
      params.set("city", city);
    }

    if (gender) {
      params.set("gender", gender);
    }

    const response =
      await fetch(
        "/api/profiles?" +
        params.toString()
      );

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        "Could not load profiles"
      );
    }

    if (
      !result.profiles ||
      result.profiles.length === 0
    ) {

      grid.innerHTML = `
        <div class="empty-state">
          <p>No verified profiles found yet.</p>
        </div>
      `;

      return;
    }

    grid.innerHTML =
      result.profiles
        .map(createProfileCard)
        .join("");

  } catch (error) {

    grid.innerHTML = `
      <div class="empty-state">
        <p>Profiles are currently unavailable.</p>
      </div>
    `;
  }
}


/* =========================
   PROFILE CARD
========================= */

function createProfileCard(profile) {

  const photo =
    profile.photo_url
      ? `<img
          src="${escapeHtml(profile.photo_url)}"
          alt="Profile"
          style="width:100%;height:100%;object-fit:cover;"
        >`
      : "👤";

  const name =
    escapeHtml(
      profile.name || "Member"
    );

  const city =
    escapeHtml(
      profile.city || "India"
    );

  const bio =
    escapeHtml(
      profile.bio ||
      "Verified community member."
    );

  const age =
    profile.age
      ? `, ${profile.age}`
      : "";

  return `
    <article class="profile-card">

      <div class="profile-photo">
        ${photo}
      </div>

      <div class="profile-body">

        <h3>
          ${name}${age}
        </h3>

        <div class="profile-city">
          📍 ${city}
        </div>

        <p class="profile-bio">
          ${bio}
        </p>

        <span class="verified">
          ✓ Verified
        </span>

      </div>

    </article>
  `;
}


/* =========================
   PAYMENT INFORMATION
========================= */

async function loadPaymentInfo() {

  const box =
    document.getElementById(
      "paymentInfo"
    );

  if (!box) return;

  try {

    const response =
      await fetch(
        "/api/payment-info"
      );

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        "Payment information unavailable"
      );
    }

    box.innerHTML = `

      <div>

        <img
          src="${result.qr}"
          class="qr-image"
          alt="UPI QR Code"
        >

        <div class="upi-id">
          UPI: ${escapeHtml(result.upiId)}
        </div>

        <p>
          Amount:
          <strong>₹${result.amount}</strong>
        </p>

        <a
          href="${result.upiLink}"
          class="btn btn-primary upi-link"
        >
          Open UPI App
        </a>

      </div>
    `;

  } catch (error) {

    box.innerHTML = `
      <p>
        Payment information could not be loaded.
      </p>
    `;
  }
}


/* =========================
   SUBMIT UTR
========================= */

async function submitUTR() {

  const input =
    document.getElementById(
      "utrInput"
    );

  const message =
    document.getElementById(
      "utrMessage"
    );

  if (!input || !message) return;

  const utr =
    input.value.trim();

  if (!utr) {

    message.textContent =
      "Please enter your UTR number.";

    message.style.color =
      "#b42318";

    return;
  }

  message.textContent =
    "Submitting UTR...";

  try {

    const response =
      await fetch(
        "/api/payment-submit",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            utr
          })
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.message ||
        "UTR submission failed"
      );
    }

    message.textContent =
      "UTR submitted successfully. Waiting for admin approval.";

    message.style.color =
      "#198754";

    input.value = "";

    await loadMyAccount();

  } catch (error) {

    message.textContent =
      error.message;

    message.style.color =
      "#b42318";
  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {

  const box =
    document.getElementById(
      "accountBox"
    );

  if (!box) return;

  try {

    const response =
      await fetch(
        "/api/me"
      );

    if (!response.ok) {

      box.innerHTML = `
        <p>
          Login to view your account.
        </p>

        <a
          href="#login"
          class="btn btn-primary"
        >
          Login
        </a>
      `;

      return;
    }

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        "Account unavailable"
      );
    }

    const user =
      result.user;

    const payment =
      result.payment;

    let paymentHtml = `
      <span class="status pending">
        Payment not submitted
      </span>
    `;

    if (payment) {

      const status =
        payment.status;

      paymentHtml = `
        <span class="status ${status}">
          ${capitalize(status)}
        </span>
      `;
    }

    box.innerHTML = `

      <div class="account-details">

        <div class="account-item">

          <small>Name</small>

          <strong>
            ${escapeHtml(user.name)}
          </strong>

        </div>

        <div class="account-item">

          <small>Email</small>

          <strong>
            ${escapeHtml(user.email)}
          </strong>

        </div>

        <div class="account-item">

          <small>City</small>

          <strong>
            ${escapeHtml(
              user.city || "-"
            )}
          </strong>

        </div>

        <div class="account-item">

          <small>Verification</small>

          <strong>
            ${
              user.verified
                ? "✓ Verified"
                : "Pending"
            }
          </strong>

        </div>

        <div class="account-item">

          <small>Payment</small>

          ${paymentHtml}

        </div>

        <div class="account-item">

          <small>UTR</small>

          <strong>
            ${
              payment
                ? escapeHtml(payment.utr)
                : "-"
            }
          </strong>

        </div>

      </div>

      <button
        class="btn btn-secondary"
        onclick="logoutUser()"
      >
        Logout
      </button>
    `;

  } catch (error) {

    box.innerHTML = `
      <p>
        Unable to load account.
      </p>
    `;
  }
}


/* =========================
   LOGOUT
========================= */

async function logoutUser() {

  try {

    await fetch(
      "/api/logout",
      {
        method: "POST"
      }
    );

  } finally {

    loadMyAccount();

    window.location.hash =
      "home";
  }
}


/* =========================
   HELPERS
========================= */

function capitalize(value) {

  if (!value) return "";

  return value.charAt(0).toUpperCase() +
    value.slice(1);
}


function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
    }
