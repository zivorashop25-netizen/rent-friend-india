document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadPaymentInfo();
  loadMyAccount();

  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  const paymentForm = document.getElementById("paymentForm");

  if (paymentForm) {
    paymentForm.addEventListener("submit", submitPayment);
  }

  const citySearch = document.getElementById("citySearch");
  const genderSearch = document.getElementById("genderSearch");

  if (citySearch) {
    citySearch.addEventListener("input", loadProfiles);
  }

  if (genderSearch) {
    genderSearch.addEventListener("change", loadProfiles);
  }
});


/* =========================
   REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const message = document.getElementById("registerMessage");

  const data = {
    name: document.getElementById("regName").value.trim(),
    phone: document.getElementById("regPhone").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    password: document.getElementById("regPassword").value,
    age: document.getElementById("regAge").value,
    city: document.getElementById("regCity").value.trim(),
    gender: document.getElementById("regGender").value,
    bio: document.getElementById("regBio")
      ? document.getElementById("regBio").value.trim()
      : ""
  };

  message.textContent = "Account create ho raha hai...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      message.textContent =
        result.message || "Account create nahi hua.";
      return;
    }

    message.textContent =
      "Account details save ho gayi hain. Ab ₹499 payment karein.";

    // Payment section automatically open
    const paymentSection =
      document.getElementById("payment");

    if (paymentSection) {
      paymentSection.scrollIntoView({
        behavior: "smooth"
      });
    }

    // Refresh payment information
    await loadPaymentInfo();

    // Refresh account
    await loadMyAccount();

  } catch (error) {
    console.error(error);

    message.textContent =
      "Server se connection nahi ho raha. Please try again.";
  }
}


/* =========================
   LOAD PAYMENT INFO
========================= */

async function loadPaymentInfo() {
  try {
    const response = await fetch("/api/payment-info");
    const result = await response.json();

    if (!result.success) return;

    const paymentInfo =
      document.getElementById("paymentInfo");

    if (!paymentInfo) return;

    paymentInfo.innerHTML = `
      <div class="payment-card">

        <h2>Complete Registration Payment</h2>

        <p>
          Account activate karne ke liye
          <strong>₹${result.amount}</strong>
          payment karein.
        </p>

        ${
          result.qrCode
            ? `
              <div class="qr-box">
                <img
                  src="${result.qrCode}"
                  alt="UPI QR Code"
                  class="payment-qr"
                />
              </div>
            `
            : ""
        }

        <p>
          <strong>UPI ID:</strong><br>
          ${escapeHtml(result.upiId)}
        </p>

        <p>
          <strong>Name:</strong>
          ${escapeHtml(result.upiName)}
        </p>

        ${
          result.upiLink
            ? `
              <a
                href="${result.upiLink}"
                class="upi-button"
              >
                Pay ₹${result.amount} with UPI App
              </a>
            `
            : ""
        }

        <p class="payment-note">
          Payment karne ke baad neeche apna
          UTR / Transaction ID submit karein.
        </p>

      </div>
    `;

    showPaymentForm();

  } catch (error) {
    console.error("Payment info error:", error);
  }
}


/* =========================
   SHOW PAYMENT FORM
========================= */

function showPaymentForm() {
  const paymentSection =
    document.getElementById("payment");

  if (paymentSection) {
    paymentSection.style.display = "block";
  }
}


/* =========================
   SUBMIT UTR
========================= */

async function submitPayment(event) {
  event.preventDefault();

  const utrInput =
    document.getElementById("utrInput");

  const message =
    document.getElementById("utrMessage");

  if (!utrInput || !message) return;

  const utr = utrInput.value.trim();

  if (!utr) {
    message.textContent =
      "Please UTR / Transaction ID enter karein.";
    return;
  }

  message.textContent =
    "Payment details submit ho rahi hain...";

  try {
    const response = await fetch(
      "/api/payment-submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          utr
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      message.textContent =
        result.message ||
        "Payment submit nahi hua.";
      return;
    }

    message.textContent =
      "UTR successfully submit ho gaya. Admin approval ka wait karein.";

    utrInput.value = "";

    await loadMyAccount();

  } catch (error) {
    console.error(error);

    message.textContent =
      "Server se connection nahi ho raha.";
  }
}


/* =========================
   LOGIN
========================= */

async function loginUser(event) {
  event.preventDefault();

  const message =
    document.getElementById("loginMessage");

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  message.textContent = "Login ho raha hai...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      message.textContent =
        result.message || "Login failed.";
      return;
    }

    message.textContent =
      result.message || "Login successful.";

    await loadMyAccount();

    if (result.paymentRequired) {
      await loadPaymentInfo();

      const paymentSection =
        document.getElementById("payment");

      if (paymentSection) {
        paymentSection.scrollIntoView({
          behavior: "smooth"
        });
      }
    }

  } catch (error) {
    console.error(error);

    message.textContent =
      "Server se connection nahi ho raha.";
  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {
  const accountBox =
    document.getElementById("accountBox");

  if (!accountBox) return;

  try {
    const response =
      await fetch("/api/me");

    if (!response.ok) {
      accountBox.innerHTML = "";
      return;
    }

    const result = await response.json();

    if (!result.success) {
      accountBox.innerHTML = "";
      return;
    }

    const user = result.user;

    let statusText = "";

    if (user.verified) {
      statusText =
        `<span class="status-success">
          Account Verified & Active
        </span>`;
    } else if (
      result.payment &&
      result.payment.status === "pending"
    ) {
      statusText =
        `<span class="status-pending">
          Payment Pending Admin Approval
        </span>`;
    } else {
      statusText =
        `<span class="status-pending">
          ₹${result.amount} Payment Required
        </span>`;
    }

    accountBox.innerHTML = `
      <div class="account-card">

        <h3>My Account</h3>

        <p>
          <strong>Name:</strong>
          ${escapeHtml(user.name)}
        </p>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(user.email)}
        </p>

        <p>
          <strong>Phone:</strong>
          ${escapeHtml(user.phone || "")}
        </p>

        <p>
          <strong>City:</strong>
          ${escapeHtml(user.city || "")}
        </p>

        <p>
          <strong>Status:</strong>
          ${statusText}
        </p>

      </div>
    `;

  } catch (error) {
    console.error("Account error:", error);
  }
}


/* =========================
   LOAD PROFILES
========================= */

async function loadProfiles() {
  const grid =
    document.getElementById("profilesGrid");

  if (!grid) return;

  const city =
    document.getElementById("citySearch")?.value
      .trim() || "";

  const gender =
    document.getElementById("genderSearch")?.value
      || "";

  let url = "/api/profiles?";

  if (city) {
    url += `city=${encodeURIComponent(city)}&`;
  }

  if (gender) {
    url += `gender=${encodeURIComponent(gender)}&`;
  }

  try {
    const response = await fetch(url);

    const result = await response.json();

    if (!result.success) {
      grid.innerHTML =
        "<p>Profiles load nahi ho rahe.</p>";
      return;
    }

    if (!result.profiles.length) {
      grid.innerHTML =
        "<p>Abhi koi verified profile available nahi hai.</p>";
      return;
    }

    grid.innerHTML =
      result.profiles.map(profile => `
        <div class="profile-card">

          ${
            profile.photo_url
              ? `
                <img
                  src="${escapeHtml(profile.photo_url)}"
                  alt="Profile"
                />
              `
              : `
                <div class="profile-placeholder">
                  ${escapeHtml(profile.name.charAt(0))}
                </div>
              `
          }

          <h3>
            ${escapeHtml(profile.name)}
          </h3>

          <p>
            ${escapeHtml(String(profile.age || ""))}
            •
            ${escapeHtml(profile.city || "")}
          </p>

          <p>
            ${escapeHtml(profile.gender || "")}
          </p>

          ${
            profile.bio
              ? `<p>${escapeHtml(profile.bio)}</p>`
              : ""
          }

        </div>
      `).join("");

  } catch (error) {
    console.error("Profiles error:", error);

    grid.innerHTML =
      "<p>Profiles load nahi ho rahe.</p>";
  }
}


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  }
