document.addEventListener(
  "DOMContentLoaded",
  () => {
    loadProfiles();
    loadPaymentInfo();
    loadMyAccount();

    const registerForm =
      document.getElementById(
        "registerForm"
      );

    if (registerForm) {
      registerForm.addEventListener(
        "submit",
        registerUser
      );
    }

    const loginForm =
      document.getElementById(
        "loginForm"
      );

    if (loginForm) {
      loginForm.addEventListener(
        "submit",
        loginUser
      );
    }

    const paymentForm =
      document.getElementById(
        "paymentForm"
      );

    if (paymentForm) {
      paymentForm.addEventListener(
        "submit",
        submitPayment
      );
    }

    const citySearch =
      document.getElementById(
        "citySearch"
      );

    const genderSearch =
      document.getElementById(
        "genderSearch"
      );

    if (citySearch) {
      citySearch.addEventListener(
        "input",
        loadProfiles
      );
    }

    if (genderSearch) {
      genderSearch.addEventListener(
        "change",
        loadProfiles
      );
    }
  }
);


/* =========================
   SAFE JSON
========================= */

async function readJson(
  response
) {
  const text =
    await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(
      "Server returned non-JSON:",
      text
    );

    return {
      success: false,
      message:
        "Server ne JSON response nahi diya. Please Render deployment check karein."
    };
  }
}


/* =========================
   REGISTER
========================= */

async function registerUser(
  event
) {
  event.preventDefault();

  const message =
    document.getElementById(
      "registerMessage"
    );

  const getValue = (id) => {
    const el =
      document.getElementById(id);

    return el
      ? el.value.trim()
      : "";
  };

  const data = {
    name: getValue(
      "regName"
    ),

    phone: getValue(
      "regPhone"
    ),

    email: getValue(
      "regEmail"
    ),

    password:
      document.getElementById(
        "regPassword"
      )?.value || "",

    age: getValue(
      "regAge"
    ),

    city: getValue(
      "regCity"
    ),

    gender:
      document.getElementById(
        "regGender"
      )?.value || "",

    bio: getValue(
      "regBio"
    )
  };

  if (message) {
    message.textContent =
      "Account create ho raha hai...";
  }

  try {
    const response =
      await fetch(
        "/api/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          credentials: "same-origin",

          body:
            JSON.stringify(data)
        }
      );

    const result =
      await readJson(
        response
      );

    if (
      !response.ok ||
      !result.success
    ) {
      if (message) {
        message.textContent =
          result.message ||
          "Account create nahi hua.";
      }

      return;
    }

    if (message) {
      message.textContent =
        "Account details save ho gayi hain. Ab ₹499 payment karein.";
    }

    await loadPaymentInfo();

    await loadMyAccount();

    const paymentSection =
      document.getElementById(
        "payment"
      );

    if (paymentSection) {
      paymentSection.style.display =
        "block";

      paymentSection.scrollIntoView({
        behavior:
          "smooth"
      });
    }
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    if (message) {
      message.textContent =
        "Server se connection nahi ho raha. Please try again.";
    }
  }
}


/* =========================
   PAYMENT INFO
========================= */

async function loadPaymentInfo() {
  try {
    const response =
      await fetch(
        "/api/payment-info",
        {
          headers: {
            "Accept":
              "application/json"
          },
          credentials:
            "same-origin"
        }
      );

    const result =
      await readJson(
        response
      );

    if (
      !response.ok ||
      !result.success
    ) {
      return;
    }

    const paymentInfo =
      document.getElementById(
        "paymentInfo"
      );

    if (!paymentInfo) {
      return;
    }

    const qr =
      result.qr ||
      result.qrCode ||
      "";

    const upiId =
      result.upi_id ||
      result.upiId ||
      "";

    const upiName =
      result.upi_name ||
      result.upiName ||
      "";

    const upiLink =
      result.upiLink ||
      "";

    paymentInfo.innerHTML = `
      <div class="payment-card">

        <h2>
          Complete Registration Payment
        </h2>

        <p>
          Account approval ke liye
          <strong>
            ₹${escapeHtml(
              result.amount
            )}
          </strong>
          payment karein.
        </p>

        ${
          qr
            ? `
              <div class="qr-box">
                <img
                  src="${escapeHtml(
                    qr
                  )}"
                  alt="UPI QR Code"
                  class="payment-qr"
                />
              </div>
            `
            : `
              <p>
                UPI QR abhi available nahi hai.
              </p>
            `
        }

        <p>
          <strong>
            UPI ID:
          </strong>
          <br>
          ${escapeHtml(
            upiId ||
              "UPI ID not configured"
          )}
        </p>

        <p>
          <strong>
            Name:
          </strong>
          ${escapeHtml(
            upiName
          )}
        </p>

        ${
          upiLink
            ? `
              <a
                href="${escapeHtml(
                  upiLink
                )}"
                class="upi-button"
              >
                Pay ₹${escapeHtml(
                  result.amount
                )} with UPI App
              </a>
            `
            : ""
        }

        <p class="payment-note">
          Payment karne ke baad
          neeche UTR / Transaction ID
          submit karein.
        </p>

      </div>
    `;

    showPaymentForm();
  } catch (error) {
    console.error(
      "PAYMENT INFO ERROR:",
      error
    );
  }
}


/* =========================
   SHOW PAYMENT
========================= */

function showPaymentForm() {
  const paymentSection =
    document.getElementById(
      "payment"
    );

  if (paymentSection) {
    paymentSection.style.display =
      "block";
  }
}


/* =========================
   SUBMIT PAYMENT
========================= */

async function submitPayment(
  event
) {
  event.preventDefault();

  const utrInput =
    document.getElementById(
      "utrInput"
    );

  const message =
    document.getElementById(
      "utrMessage"
    );

  if (
    !utrInput ||
    !message
  ) {
    return;
  }

  const utr =
    utrInput.value.trim();

  if (!utr) {
    message.textContent =
      "Please UTR / Transaction ID enter karein.";

    return;
  }

  message.textContent =
    "Payment details submit ho rahi hain...";

  try {
    const response =
      await fetch(
        "/api/payment/submit",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              utr
            })
        }
      );

    const result =
      await readJson(
        response
      );

    if (
      !response.ok ||
      !result.success
    ) {
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
    console.error(
      "PAYMENT SUBMIT ERROR:",
      error
    );

    message.textContent =
      "Server se connection nahi ho raha.";
  }
}


/* =========================
   LOGIN
========================= */

async function loginUser(
  event
) {
  event.preventDefault();

  const message =
    document.getElementById(
      "loginMessage"
    );

  const email =
    document.getElementById(
      "loginEmail"
    )?.value.trim() || "";

  const password =
    document.getElementById(
      "loginPassword"
    )?.value || "";

  if (message) {
    message.textContent =
      "Login ho raha hai...";
  }

  try {
    const response =
      await fetch(
        "/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    const result =
      await readJson(
        response
      );

    if (
      !response.ok ||
      !result.success
    ) {
      if (message) {
        message.textContent =
          result.message ||
          "Login failed.";
      }

      return;
    }

    if (message) {
      message.textContent =
        result.message ||
        "Login successful.";
    }

    await loadMyAccount();

    if (
      result.paymentRequired
    ) {
      await loadPaymentInfo();

      const paymentSection =
        document.getElementById(
          "payment"
        );

      if (paymentSection) {
        paymentSection.style.display =
          "block";

        paymentSection.scrollIntoView({
          behavior:
            "smooth"
        });
      }
    }
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    if (message) {
      message.textContent =
        "Server se connection nahi ho raha.";
    }
  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {
  const accountBox =
    document.getElementById(
      "accountBox"
    );

  if (!accountBox) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/me",
        {
          headers: {
            "Accept":
              "application/json"
          },

          credentials:
            "same-origin"
        }
      );

    if (!response.ok) {
      accountBox.innerHTML =
        "";

      return;
    }

    const result =
      await readJson(
        response
      );

    if (
      !result.success
    ) {
      accountBox.innerHTML =
        "";

      return;
    }

    const user =
      result.user;

    const payment =
      result.payment;

    let statusText =
      "";

    if (
      user.verified
    ) {
      statusText = `
        <span class="status-success">
          Account Verified & Active
        </span>
      `;
    } else if (
      payment &&
      payment.status ===
        "pending"
    ) {
      statusText = `
        <span class="status-pending">
          Payment Pending Admin Approval
        </span>
      `;
    } else if (
      payment &&
      payment.status ===
        "rejected"
    ) {
      statusText = `
        <span class="status-pending">
          Payment Rejected - Please Submit Again
        </span>
      `;
    } else {
      statusText = `
        <span class="status-pending">
          ₹${escapeHtml(
            result.amount ||
              499
          )} Payment Required
        </span>
      `;
    }

    accountBox.innerHTML = `
      <div class="account-card">

        <h3>
          My Account
        </h3>

        <p>
          <strong>
            Name:
          </strong>
          ${escapeHtml(
            user.name
          )}
        </p>

        <p>
          <strong>
            Email:
          </strong>
          ${escapeHtml(
            user.email
          )}
        </p>

        <p>
          <strong>
            Phone:
          </strong>
          ${escapeHtml(
            user.phone || ""
          )}
        </p>

        <p>
          <strong>
            City:
          </strong>
          ${escapeHtml(
            user.city || ""
          )}
        </p>

        <p>
          <strong>
            Status:
          </strong>
          ${statusText}
        </p>

      </div>
    `;
  } catch (error) {
    console.error(
      "ACCOUNT ERROR:",
      error
    );
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

  if (!grid) {
    return;
  }

  const city =
    document.getElementById(
      "citySearch"
    )?.value.trim() || "";

  const gender =
    document.getElementById(
      "genderSearch"
    )?.value || "";

  let url =
    "/api/profiles?";

  if (city) {
    url +=
      "city=" +
      encodeURIComponent(
        city
      ) +
      "&";
  }

  if (gender) {
    url +=
      "gender=" +
      encodeURIComponent(
        gender
      ) +
      "&";
  }

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    const result =
      await readJson(
        response
      );

    if (
      !response.ok ||
      !result.success
    ) {
      grid.innerHTML =
        "<p>Profiles load nahi ho rahe.</p>";

      return;
    }

    if (
      !result.profiles ||
      !result.profiles.length
    ) {
      grid.innerHTML =
        "<p>Abhi koi verified profile available nahi hai.</p>";

      return;
    }

    grid.innerHTML =
      result.profiles
        .map(
          (profile) => `
        <div class="profile-card">

          ${
            profile.photo_url
              ? `
                <img
                  src="${escapeHtml(
                    profile.photo_url
                  )}"
                  alt="Profile"
                />
              `
              : `
                <div class="profile-placeholder">
                  ${escapeHtml(
                    (
                      profile.name ||
                      "U"
                    ).charAt(0)
                  )}
                </div>
              `
          }

          <h3>
            ${escapeHtml(
              profile.name
            )}
          </h3>

          <p>
            ${escapeHtml(
              String(
                profile.age ||
                  ""
              )
            )}
            •
            ${escapeHtml(
              profile.city ||
                ""
            )}
          </p>

          <p>
            ${escapeHtml(
              profile.gender ||
                ""
            )}
          </p>

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
      `
        )
        .join("");
  } catch (error) {
    console.error(
      "PROFILES ERROR:",
      error
    );

    grid.innerHTML =
      "<p>Profiles load nahi ho rahe.</p>";
  }
}


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
      }
