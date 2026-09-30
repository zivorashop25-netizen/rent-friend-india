document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadPaymentInfo();
  loadMyAccount();

  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const paymentForm = document.getElementById("paymentForm");
  const searchForm = document.getElementById("searchForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", submitPayment);
  }

  if (searchForm) {
    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      loadProfiles();
    });
  }
});


/* =========================
   REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const message = document.getElementById("registerMessage");
  const form = event.target;

  if (message) {
    message.textContent = "Creating registration request...";
  }

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
      throw new Error(
        result.message || "Registration failed"
      );
    }

    /*
      IMPORTANT:
      Registration is NOT treated as successful yet.
      User must complete ₹499 payment and submit UTR.
    */

    if (message) {
      message.textContent =
        "Registration details saved. Now complete the ₹499 payment.";
    }

    await loadPaymentInfo();

    showPaymentSection(true);

    await loadMyAccount();

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (message) {
      message.textContent = error.message;
    }
  }
}


/* =========================
   LOGIN
========================= */

async function loginUser(event) {
  event.preventDefault();

  const message =
    document.getElementById("loginMessage");

  const form = event.target;

  if (message) {
    message.textContent = "Logging in...";
  }

  const data = {
    email: form.email
      ? form.email.value.trim()
      : "",
    password: form.password
      ? form.password.value
      : ""
  };

  try {
    const response = await fetch(
      "/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(data)
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Login failed"
      );
    }

    if (message) {
      message.textContent =
        result.user && result.user.verified
          ? "Login successful."
          : "Login successful. ₹499 payment is pending.";
    }

    await loadMyAccount();

    if (
      !result.user ||
      !result.user.verified
    ) {
      await loadPaymentInfo();
      showPaymentSection(true);
    }

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    if (message) {
      message.textContent =
        error.message;
    }
  }
}


/* =========================
   PAYMENT INFORMATION
========================= */

async function loadPaymentInfo() {
  const paymentInfo =
    document.getElementById("paymentInfo");

  if (!paymentInfo) return;

  try {
    const response = await fetch(
      "/api/payment-info",
      {
        credentials: "include"
      }
    );

    const result =
      await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Could not load payment information"
      );
    }

    const amount =
      result.amount || 499;

    const upiId =
      result.upi_id || "";

    const upiName =
      result.upi_name ||
      "Rent Friend India";

    const qr =
      result.qr || "";

    let html = `
      <div class="payment-box">

        <h2>Complete Registration</h2>

        <p>
          Registration Fee:
          <strong>₹${escapeHtml(
            String(amount)
          )}</strong>
        </p>

        <p>
          Pay the registration fee using
          UPI or scan the QR code.
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
        "?pa=" +
        encodeURIComponent(upiId) +
        "&pn=" +
        encodeURIComponent(upiName) +
        "&am=" +
        encodeURIComponent(amount) +
        "&cu=INR";

      html += `
        <p>
          <strong>UPI ID:</strong><br>
          <span>
            ${escapeHtml(upiId)}
          </span>
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
          Pay ₹${escapeHtml(
            String(amount)
          )} with UPI App
        </a>

        <p>
          After payment, enter your
          UTR / Transaction ID below.
        </p>
      `;
    } else {
      html += `
        <p>
          UPI payment is not configured.
        </p>
      `;
    }

    html += `
      </div>
    `;

    paymentInfo.innerHTML = html;

    const copyButton =
      document.getElementById(
        "copyUpiButton"
      );

    if (copyButton && upiId) {
      copyButton.addEventListener(
        "click",
        async () => {
          try {
            await navigator.clipboard.writeText(
              upiId
            );

            copyButton.textContent =
              "UPI ID Copied!";
          } catch (error) {
            alert(
              "UPI ID: " + upiId
            );
          }
        }
      );
    }

  } catch (error) {
    console.error(
      "PAYMENT INFO ERROR:",
      error
    );

    paymentInfo.innerHTML = `
      <p>
        ${escapeHtml(error.message)}
      </p>
    `;
  }
}


/* =========================
   SUBMIT PAYMENT / UTR
========================= */

async function submitPayment(event) {
  event.preventDefault();

  const message =
    document.getElementById(
      "paymentMessage"
    );

  const form = event.target;

  const utrInput =
    form.querySelector(
      '[name="utr"]'
    ) ||
    document.getElementById("utr");

  const utr =
    utrInput
      ? utrInput.value.trim()
      : "";

  if (!utr) {
    if (message) {
      message.textContent =
        "Please enter your UTR / Transaction ID.";
    }

    return;
  }

  if (utr.length < 6) {
    if (message) {
      message.textContent =
        "Please enter a valid UTR / Transaction ID.";
    }

    return;
  }

  if (message) {
    message.textContent =
      "Submitting payment details...";
  }

  try {
    const response =
      await fetch(
        "/api/payment/submit",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            utr: utr
          })
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Payment submission failed"
      );
    }

    if (message) {
      message.textContent =
        "Payment submitted. Waiting for admin approval.";
    }

    if (utrInput) {
      utrInput.value = "";
    }

    await loadMyAccount();

  } catch (error) {
    console.error(
      "PAYMENT ERROR:",
      error
    );

    if (message) {
      message.textContent =
        error.message;
    }
  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {
  const accountBox =
    document.getElementById(
      "myAccount"
    );

  try {
    const response =
      await fetch(
        "/api/me",
        {
          credentials: "include"
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success ||
      !result.user
    ) {
      if (accountBox) {
        accountBox.innerHTML =
          "<p>Please login to view your account.</p>";
      }

      return;
    }

    const user =
      result.user;

    const payment =
      await loadPaymentStatus();

    if (!accountBox) return;

    let statusText = "";
    let showPayment = false;

    if (
      user.verified &&
      user.active
    ) {

      statusText = `
        <p class="success">
          <strong>
            Account Active & Verified ✓
          </strong>
        </p>
      `;

    } else if (
      payment &&
      payment.status === "pending"
    ) {

      statusText = `
        <p>
          <strong>
            Payment Status:
          </strong>
          Pending Admin Approval
        </p>

        <p>
          Your UTR has been submitted.
          Please wait for approval.
        </p>
      `;

    } else if (
      payment &&
      payment.status === "rejected"
    ) {

      statusText = `
        <p>
          <strong>
            Payment Status:
          </strong>
          Rejected
        </p>

        <p>
          Please make the payment again
          and submit the correct UTR.
        </p>
      `;

      showPayment = true;

    } else {

      statusText = `
        <p>
          <strong>
            Payment Required: ₹499
          </strong>
        </p>

        <p>
          Complete the payment and
          submit your UTR.
        </p>
      `;

      showPayment = true;
    }

    accountBox.innerHTML = `
      <div class="account-box">

        <h2>My Account</h2>

        <p>
          <strong>Name:</strong>
          ${escapeHtml(
            user.name || ""
          )}
        </p>

        <p>
          <strong>Email:</strong>
          ${escapeHtml(
            user.email || ""
          )}
        </p>

        <p>
          <strong>Phone:</strong>
          ${escapeHtml(
            user.phone || ""
          )}
        </p>

        <p>
          <strong>City:</strong>
          ${escapeHtml(
            user.city || ""
          )}
        </p>

        ${statusText}

      </div>
    `;

    if (showPayment) {
      showPaymentSection(false);
    }

  } catch (error) {
    console.error(
      "ACCOUNT ERROR:",
      error
    );

    if (accountBox) {
      accountBox.innerHTML =
        "<p>Please login to view your account.</p>";
    }
  }
}


/* =========================
   PAYMENT STATUS
========================= */

async function loadPaymentStatus() {
  try {
    const response =
      await fetch(
        "/api/payment/status",
        {
          credentials: "include"
        }
      );

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      return null;
    }

    return result.payment || null;

  } catch (error) {
    console.error(error);
    return null;
  }
}


/* =========================
   SHOW PAYMENT
========================= */

function showPaymentSection(
  scrollToPayment = false
) {
  const section =
    document.getElementById(
      "payment"
    );

  if (!section) return;

  section.style.display =
    "block";

  if (scrollToPayment) {
    setTimeout(() => {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 300);
  }
}


/* =========================
   LOAD PROFILES
========================= */

async function loadProfiles() {
  const profilesContainer =
    document.getElementById(
      "profiles"
    );

  if (!profilesContainer) return;

  const cityInput =
    document.getElementById(
      "searchCity"
    );

  const genderInput =
    document.getElementById(
      "searchGender"
    );

  const city =
    cityInput
      ? cityInput.value.trim()
      : "";

  const gender =
    genderInput
      ? genderInput.value
          .trim()
          .toLowerCase()
      : "";

  profilesContainer.innerHTML =
    "<p>Loading profiles...</p>";

  try {

    let url =
      "/api/profiles";

    if (city) {
      url +=
        "?city=" +
        encodeURIComponent(city);
    }

    const response =
      await fetch(url);

    const result =
      await response.json();

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ||
        "Could not load profiles"
      );
    }

    let profiles =
      result.profiles || [];

    if (gender) {
      profiles =
        profiles.filter(
          profile =>
            String(
              profile.gender || ""
            )
              .toLowerCase()
              .includes(gender)
        );
    }

    if (profiles.length === 0) {
      profilesContainer.innerHTML =
        "<p>No verified profiles found.</p>";

      return;
    }

    profilesContainer.innerHTML =
      profiles
        .map(profile => {

          const photo =
            profile.photo_url
              ? `
                <img
                  src="${escapeHtml(
                    profile.photo_url
                  )}"
                  alt="${escapeHtml(
                    profile.name ||
                    "Profile"
                  )}"
                  class="profile-photo"
                >
              `
              : `
                <div class="profile-photo-placeholder">
                  No Photo
                </div>
              `;

          return `
            <div class="profile-card">

              ${photo}

              <h3>
                ${escapeHtml(
                  profile.name || ""
                )}
              </h3>

              <p>
                ${escapeHtml(
                  profile.city || ""
                )}
              </p>

              <p>
                ${escapeHtml(
                  profile.gender || ""
                )}
              </p>

              ${
                profile.age
                  ? `
                    <p>
                      Age:
                      ${escapeHtml(
                        String(
                          profile.age
                        )
                      )}
                    </p>
                  `
                  : ""
              }

              ${
                profile.bio
                  ? `
                    <p>
                      ${escapeHtml(
                        profile.bio
                      )}
                    </p>
                  `
                  : ""
              }

            </div>
          `;
        })
        .join("");

  } catch (error) {
    console.error(
      "PROFILES ERROR:",
      error
    );

    profilesContainer.innerHTML =
      `<p>${escapeHtml(
        error.message
      )}</p>`;
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
        method: "POST",
        credentials: "include"
      }
    );
  } catch (error) {
    console.error(error);
  }

  window.location.reload();
}


/* =========================
   MOBILE MENU
========================= */

function toggleMenu() {
  const navMenu =
    document.getElementById(
      "navMenu"
    );

  if (!navMenu) return;

  navMenu.classList.toggle(
    "active"
  );
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
    }
