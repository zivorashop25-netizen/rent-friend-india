document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadPaymentInfo();
  loadMyAccount();

  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const paymentForm = document.getElementById("paymentForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", submitPayment);
  }

  const searchForm = document.getElementById("searchForm");

  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      loadProfiles();
    });
  }
});


// ===============================
// REGISTER
// ===============================

async function registerUser(event) {
  event.preventDefault();

  const message = document.getElementById("registerMessage");

  if (message) {
    message.textContent = "Creating your account...";
  }

  const form = event.target;

  const data = {
    name: form.name ? form.name.value.trim() : "",
    phone: form.phone ? form.phone.value.trim() : "",
    email: form.email ? form.email.value.trim() : "",
    password: form.password ? form.password.value : "",
    age: form.age ? Number(form.age.value) : null,
    city: form.city ? form.city.value.trim() : "",
    gender: form.gender ? form.gender.value : ""
  };

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Registration failed");
    }

    if (message) {
      message.textContent =
        "Account created. Complete the ₹499 payment to activate your account.";
    }

    await loadPaymentInfo();
    await loadMyAccount();

    showPaymentSection(true);

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}


// ===============================
// LOGIN
// ===============================

async function loginUser(event) {
  event.preventDefault();

  const message = document.getElementById("loginMessage");

  if (message) {
    message.textContent = "Logging in...";
  }

  const form = event.target;

  const data = {
    email: form.email ? form.email.value.trim() : "",
    password: form.password ? form.password.value : ""
  };

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Login failed");
    }

    if (message) {
      message.textContent = "Login successful.";
    }

    await loadMyAccount();

    if (!result.user || !result.user.verified) {
      await loadPaymentInfo();
      showPaymentSection(true);
    }

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}


// ===============================
// PAYMENT INFORMATION
// ===============================

async function loadPaymentInfo() {
  const paymentInfo = document.getElementById("paymentInfo");

  try {
    const response = await fetch("/api/payment-info", {
      credentials: "include"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not load payment information");
    }

    const amount = result.amount || 499;
    const upiId = result.upi_id || "";
    const upiName = result.upi_name || "Rent Friend India";
    const qr = result.qr || "";

    if (!paymentInfo) return;

    let html = `
      <div class="payment-box">

        <h2>Complete Registration Payment</h2>

        <p>
          Registration Fee:
          <strong>₹${escapeHtml(String(amount))}</strong>
        </p>

        <p>
          Pay ₹${escapeHtml(String(amount))} using UPI.
        </p>
    `;

    if (qr) {
      html += `
        <div class="qr-container">
          <img
            src="${qr}"
            alt="UPI QR Code"
            class="payment-qr"
          >
        </div>
      `;
    }

    if (upiId) {
      const upiLink =
        "upi://pay" +
        "?pa=" + encodeURIComponent(upiId) +
        "&pn=" + encodeURIComponent(upiName) +
        "&am=" + encodeURIComponent(amount) +
        "&cu=INR";

      html += `
        <p>
          <strong>UPI ID:</strong><br>
          <span>${escapeHtml(upiId)}</span>
        </p>

        <button
          type="button"
          id="copyUpiButton"
          class="btn"
        >
          Copy UPI ID
        </button>

        <br><br>

        <a
          href="${upiLink}"
          class="btn"
        >
          Pay ₹${escapeHtml(String(amount))} with UPI App
        </a>
      `;
    } else {
      html += `
        <p>
          <strong>UPI payment is not configured yet.</strong>
        </p>
      `;
    }

    html += `
        <p>
          After payment, enter your UTR / Transaction ID below.
        </p>

      </div>
    `;

    paymentInfo.innerHTML = html;

    const copyButton = document.getElementById("copyUpiButton");

    if (copyButton && upiId) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(upiId);
          copyButton.textContent = "UPI ID Copied!";
        } catch (error) {
          alert("UPI ID: " + upiId);
        }
      });
    }

  } catch (error) {
    console.error(error);

    if (paymentInfo) {
      paymentInfo.innerHTML = `
        <p>${escapeHtml(error.message)}</p>
      `;
    }
  }
}


// ===============================
// SUBMIT UTR / PAYMENT
// ===============================

async function submitPayment(event) {
  event.preventDefault();

  const message = document.getElementById("paymentMessage");

  if (message) {
    message.textContent = "Submitting payment details...";
  }

  const form = event.target;

  const utrInput =
    form.querySelector('[name="utr"]') ||
    document.getElementById("utr");

  const utr = utrInput ? utrInput.value.trim() : "";

  if (!utr) {
    if (message) {
      message.textContent = "Please enter your UTR / Transaction ID.";
    }
    return;
  }

  if (utr.length < 6) {
    if (message) {
      message.textContent = "Please enter a valid UTR / Transaction ID.";
    }
    return;
  }

  try {
    const response = await fetch("/api/payment/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        utr: utr
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Payment submission failed");
    }

    if (message) {
      message.textContent =
        "Payment submitted successfully. Waiting for admin approval.";
    }

    if (utrInput) {
      utrInput.value = "";
    }

    await loadMyAccount();

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}


// ===============================
// MY ACCOUNT
// ===============================

async function loadMyAccount() {
  const accountBox = document.getElementById("myAccount");

  try {
    const response = await fetch("/api/me", {
      credentials: "include"
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.user) {
      if (accountBox) {
        accountBox.innerHTML = `
          <p>Please login to view your account.</p>
        `;
      }

      return;
    }

    const user = result.user;

    let payment = null;

    try {
      const paymentResponse = await fetch("/api/payment/status", {
        credentials: "include"
      });

      const paymentResult = await paymentResponse.json();

      if (paymentResult.success) {
        payment = paymentResult.payment || null;
      }
    } catch (paymentError) {
      console.error(paymentError);
    }

    if (!accountBox) return;

    let statusText = "";
    let showPayment = false;

    if (user.verified && user.active) {
      statusText = `
        <p class="success">
          <strong>Account Active & Verified ✓</strong>
        </p>
      `;
    } else if (payment && payment.status === "pending") {
      statusText = `
        <p>
          <strong>Payment Status:</strong> Pending Admin Approval
        </p>
        <p>
          Your UTR has been submitted. Please wait for approval.
        </p>
      `;
    } else if (payment && payment.status === "rejected") {
      statusText = `
        <p>
          <strong>Payment Status:</strong> Rejected
        </p>
        <p>
          Please check your payment details and submit the correct UTR.
        </p>
      `;

      showPayment = true;

    } else if (payment && payment.status === "approved") {
      statusText = `
        <p>
          <strong>Payment Approved ✓</strong>
        </p>
        <p>
          Your account is being activated.
        </p>
      `;
    } else {
      statusText = `
        <p>
          <strong>Payment Required:</strong> ₹499
        </p>
        <p>
          Complete the payment and submit your UTR to activate your account.
        </p>
      `;

      showPayment = true;
    }

    accountBox.innerHTML = `
      <div class="account-box">

        <h2>My Account</h2>

        <p>
          <strong>Name:</strong>
          ${escapeHtml(user.name || "")}
        </p>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(user.email || "")}
        </p>

        <p>
          <strong>Phone:</strong>
          ${escapeHtml(user.phone || "")}
        </p>

        <p>
          <strong>City:</strong>
          ${escapeHtml(user.city || "")}
        </p>

        ${statusText}

      </div>
    `;

    if (showPayment) {
      showPaymentSection(false);
    }

  } catch (error) {
    console.error(error);

    if (accountBox) {
      accountBox.innerHTML = `
        <p>Please login to view your account.</p>
      `;
    }
  }
}


// ===============================
// PAYMENT STATUS
// ===============================

async function loadPaymentStatus() {
  try {
    const response = await fetch("/api/payment/status", {
      credentials: "include"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return null;
    }

    return result.payment || null;

  } catch (error) {
    console.error(error);
    return null;
  }
}


// ===============================
// SHOW PAYMENT SECTION
// ===============================

function showPaymentSection(scrollToPayment = false) {
  const section = document.getElementById("payment");

  if (!section) return;

  section.style.display = "block";

  if (scrollToPayment) {
    setTimeout(() => {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 300);
  }
}


// ===============================
// LOAD PROFILES
// ===============================

async function loadProfiles() {
  const profilesContainer =
    document.getElementById("profiles");

  if (!profilesContainer) return;

  const cityInput =
    document.getElementById("searchCity");

  const genderInput =
    document.getElementById("searchGender");

  const city =
    cityInput ? cityInput.value.trim() : "";

  const gender =
    genderInput ? genderInput.value.trim().toLowerCase() : "";

  profilesContainer.innerHTML = `
    <p>Loading profiles...</p>
  `;

  try {
    let url = "/api/profiles";

    if (city) {
      url += "?city=" + encodeURIComponent(city);
    }

    const response = await fetch(url);

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Could not load profiles");
    }

    let profiles = result.profiles || [];

    // Backend currently supports city filtering.
    // Gender filtering is done here so it works with the current backend.
    if (gender) {
      profiles = profiles.filter(profile => {
        return String(profile.gender || "")
          .toLowerCase()
          .includes(gender);
      });
    }

    if (profiles.length === 0) {
      profilesContainer.innerHTML = `
        <p>No verified profiles found.</p>
      `;
      return;
    }

    profilesContainer.innerHTML = profiles.map(profile => {

      const photo = profile.photo_url
        ? `<img
             src="${escapeHtml(profile.photo_url)}"
             alt="${escapeHtml(profile.name || "Profile")}"
             class="profile-photo"
           >`
        : `<div class="profile-photo-placeholder">
             No Photo
           </div>`;

      return `
        <div class="profile-card">

          ${photo}

          <h3>
            ${escapeHtml(profile.name || "")}
          </h3>

          <p>
            ${escapeHtml(profile.city || "")}
          </p>

          <p>
            ${escapeHtml(profile.gender || "")}
          </p>

          ${
            profile.age
              ? `<p>Age: ${escapeHtml(String(profile.age))}</p>`
              : ""
          }

          ${
            profile.bio
              ? `<p>${escapeHtml(profile.bio)}</p>`
              : ""
          }

        </div>
      `;

    }).join("");

  } catch (error) {
    console.error(error);

    profilesContainer.innerHTML = `
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}


// ===============================
// LOGOUT
// ===============================

async function logoutUser() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error(error);
  }

  window.location.reload();
}


// ===============================
// MOBILE MENU
// ===============================

function toggleMenu() {
  const navMenu = document.getElementById("navMenu");

  if (!navMenu) return;

  navMenu.classList.toggle("active");
}


// ===============================
// ESCAPE HTML
// ===============================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
                         }
