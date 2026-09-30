document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadPaymentInfo();
  loadMyAccount();

  const registerForm =
    document.getElementById("registerForm");

  const loginForm =
    document.getElementById("loginForm");

  const paymentForm =
    document.getElementById("paymentForm");

  const searchForm =
    document.getElementById("searchForm");

  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      registerUser
    );
  }

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      loginUser
    );
  }

  if (paymentForm) {
    paymentForm.addEventListener(
      "submit",
      submitPayment
    );
  }

  if (searchForm) {
    searchForm.addEventListener(
      "submit",
      function (e) {
        e.preventDefault();
        loadProfiles();
      }
    );
  }
});


/* =========================
   REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const message =
    document.getElementById(
      "registerMessage"
    );

  const form = event.target;

  if (message) {
    message.textContent =
      "Creating account...";
  }

  const data = {
    name: form.name
      ? form.name.value.trim()
      : "",

    phone: form.phone
      ? form.phone.value.trim()
      : "",

    email: form.email
      ? form.email.value.trim()
      : "",

    password: form.password
      ? form.password.value
      : "",

    age: form.age
      ? Number(form.age.value)
      : null,

    city: form.city
      ? form.city.value.trim()
      : "",

    gender: form.gender
      ? form.gender.value
      : ""
  };

  try {
    const response =
      await fetch(
        "/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          credentials: "include",
          body:
            JSON.stringify(data)
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
        "Registration failed"
      );
    }

    if (message) {
      message.textContent =
        "Account details saved. Please complete ₹499 payment.";
    }

    /*
      IMPORTANT:
      Account is NOT verified yet.
      Payment page is shown now.
    */

    createPaymentSection();

    await loadPaymentInfo();

    showPaymentSection(
      true
    );

    await loadMyAccount();

  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    if (message) {
      message.textContent =
        error.message;
    }
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

  const form = event.target;

  if (message) {
    message.textContent =
      "Logging in...";
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
    const response =
      await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          credentials: "include",
          body:
            JSON.stringify(data)
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
        "Login failed"
      );
    }

    if (message) {
      message.textContent =
        result.user &&
        result.user.verified
          ? "Login successful."
          : "Login successful. ₹499 payment is pending.";
    }

    await loadMyAccount();

    if (
      !result.user ||
      !result.user.verified
    ) {
      createPaymentSection();

      await loadPaymentInfo();

      showPaymentSection(
        true
      );
    }

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    if (message) {
      message.textContent =
        error.message;
    }
  }
}


/* =========================
   CREATE PAYMENT SECTION
========================= */

function createPaymentSection() {

  let section =
    document.getElementById(
      "payment"
    );

  if (section) {
    return section;
  }

  section =
    document.createElement(
      "section"
    );

  section.id =
    "payment";

  section.style.display =
    "none";

  section.style.padding =
    "25px";

  section.style.margin =
    "25px auto";

  section.style.maxWidth =
    "600px";

  section.style.background =
    "#ffffff";

  section.style.borderRadius =
    "16px";

  section.style.boxShadow =
    "0 5px 25px rgba(0,0,0,0.12)";

  section.innerHTML = `
    <div
      id="paymentInfo"
      style="text-align:center;"
    >
      <p>Loading payment details...</p>
    </div>

    <form
      id="paymentForm"
      style="margin-top:20px;"
    >

      <label
        for="utr"
        style="
          display:block;
          margin-bottom:8px;
          font-weight:bold;
        "
      >
        UTR / Transaction ID
      </label>

      <input
        type="text"
        id="utr"
        name="utr"
        placeholder="Enter UTR / Transaction ID"
        required
        minlength="6"
        style="
          width:100%;
          padding:12px;
          border:1px solid #ccc;
          border-radius:8px;
          box-sizing:border-box;
        "
      >

      <button
        type="submit"
        style="
          width:100%;
          margin-top:15px;
          padding:13px;
          border:0;
          border-radius:8px;
          cursor:pointer;
          font-weight:bold;
        "
      >
        Submit Payment Details
      </button>

      <p
        id="paymentMessage"
        style="
          margin-top:15px;
          text-align:center;
        "
      ></p>

    </form>
  `;

  document.body.appendChild(
    section
  );

  const form =
    document.getElementById(
      "paymentForm"
    );

  if (form) {
    form.addEventListener(
      "submit",
      submitPayment
    );
  }

  return section;
}


/* =========================
   LOAD PAYMENT INFO
========================= */

async function loadPaymentInfo() {

  let paymentInfo =
    document.getElementById(
      "paymentInfo"
    );

  /*
    If payment section does not
    exist yet, create it.
  */

  if (!paymentInfo) {
    createPaymentSection();

    paymentInfo =
      document.getElementById(
        "paymentInfo"
      );
  }

  if (!paymentInfo) {
    return;
  }

  try {

    const response =
      await fetch(
        "/api/payment-info",
        {
          credentials:
            "include"
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
        "Could not load payment information"
      );
    }

    const amount =
      result.amount || 499;

    /*
      Fallback UPI ID
    */

    const upiId =
      result.upi_id ||
      "8822627454-3@ybl";

    const upiName =
      result.upi_name ||
      "Rent Friend India";

    const qr =
      result.qr || "";

    const upiLink =
      "upi://pay" +
      "?pa=" +
      encodeURIComponent(
        upiId
      ) +
      "&pn=" +
      encodeURIComponent(
        upiName
      ) +
      "&am=" +
      encodeURIComponent(
        amount
      ) +
      "&cu=INR";

    let html = `

      <div
        style="
          text-align:center;
        "
      >

        <h2>
          Complete Registration
        </h2>

        <p
          style="
            font-size:22px;
            font-weight:bold;
          "
        >
          Registration Fee:
          ₹${escapeHtml(
            String(amount)
          )}
        </p>

        <p>
          Payment karne ke liye
          neeche QR scan karein ya
          UPI ID use karein.
        </p>

    `;

    if (qr) {

      html += `

        <div
          style="
            margin:20px 0;
          "
        >

          <img
            src="${qr}"
            alt="UPI QR Code"
            style="
              width:230px;
              max-width:80%;
              border:1px solid #ddd;
              padding:10px;
              border-radius:12px;
            "
          >

        </div>

      `;

    } else {

      html += `

        <div
          style="
            padding:15px;
            margin:15px 0;
            border:1px solid #ddd;
            border-radius:10px;
          "
        >
          <strong>
            UPI ID
          </strong>
          <br>
          ${escapeHtml(
            upiId
          )}
        </div>

      `;
    }

    html += `

        <p>
          <strong>
            UPI ID:
          </strong>
          <br>

          <span
            id="displayUpiId"
            style="
              font-size:18px;
              font-weight:bold;
              word-break:break-all;
            "
          >
            ${escapeHtml(
              upiId
            )}
          </span>
        </p>

        <button
          type="button"
          id="copyUpiButton"
          style="
            padding:12px 20px;
            border:0;
            border-radius:8px;
            cursor:pointer;
          "
        >
          Copy UPI ID
        </button>

        <br><br>

        <a
          href="${upiLink}"
          style="
            display:inline-block;
            padding:13px 20px;
            border-radius:8px;
            text-decoration:none;
            font-weight:bold;
          "
        >
          Pay ₹${escapeHtml(
            String(amount)
          )} with UPI App
        </a>

        <hr
          style="
            margin:25px 0;
          "
        >

        <h3>
          Payment ke baad
        </h3>

        <p>
          Apna UTR / Transaction ID
          neeche enter karein.
        </p>

      </div>
    `;

    paymentInfo.innerHTML =
      html;

    const copyButton =
      document.getElementById(
        "copyUpiButton"
      );

    if (
      copyButton &&
      upiId
    ) {

      copyButton.addEventListener(
        "click",
        async () => {

          try {

            await navigator
              .clipboard
              .writeText(
                upiId
              );

            copyButton.textContent =
              "UPI ID Copied ✓";

          } catch (error) {

            alert(
              "UPI ID: " +
              upiId
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
        ${escapeHtml(
          error.message
        )}
      </p>
    `;
  }
}


/* =========================
   SUBMIT PAYMENT / UTR
========================= */

async function submitPayment(
  event
) {
  event.preventDefault();

  const message =
    document.getElementById(
      "paymentMessage"
    );

  const form =
    event.target;

  const utrInput =
    form.querySelector(
      '[name="utr"]'
    ) ||
    document.getElementById(
      "utr"
    );

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

          credentials:
            "include",

          body:
            JSON.stringify({
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
        "Payment submitted successfully. Admin approval ka wait karein.";
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
          credentials:
            "include"
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

    if (!accountBox) {
      return;
    }

    let statusText = "";

    let showPayment =
      false;

    if (
      user.verified &&
      user.active
    ) {

      statusText = `
        <p>
          <strong>
            Account Active & Verified ✓
          </strong>
        </p>
      `;

    } else if (
      payment &&
      payment.status ===
        "pending"
    ) {

      statusText = `
        <p>
          <strong>
            Payment Status:
          </strong>
          Pending Admin Approval
        </p>

        <p>
          UTR submitted successfully.
          Please wait for approval.
        </p>
      `;

    } else if (
      payment &&
      payment.status ===
        "rejected"
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

      showPayment =
        true;

    } else {

      statusText = `
        <p>
          <strong>
            Payment Required: ₹499
          </strong>
        </p>

        <p>
          Complete payment and
          submit your UTR.
        </p>
      `;

      showPayment =
        true;
    }

    accountBox.innerHTML = `

      <div
        class="account-box"
      >

        <h2>
          My Account
        </h2>

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

      createPaymentSection();

      showPaymentSection(
        false
      );
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
          credentials:
            "include"
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

    return (
      result.payment ||
      null
    );

  } catch (error) {

    console.error(
      "PAYMENT STATUS ERROR:",
      error
    );

    return null;
  }
}


/* =========================
   SHOW PAYMENT SECTION
========================= */

function showPaymentSection(
  scrollToPayment = false
) {

  const section =
    createPaymentSection();

  if (!section) {
    return;
  }

  section.style.display =
    "block";

  if (scrollToPayment) {

    setTimeout(() => {

      section.scrollIntoView({
        behavior:
          "smooth",
        block:
          "start"
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

  if (!profilesContainer) {
    return;
  }

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

    const params =
      new URLSearchParams();

    if (city) {
      params.set(
        "city",
        city
      );
    }

    if (gender) {
      params.set(
        "gender",
        gender
      );
    }

    if (
      params.toString()
    ) {
      url +=
        "?" +
        params.toString();
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

    const profiles =
      result.profiles || [];

    if (
      profiles.length === 0
    ) {

      profilesContainer.innerHTML =
        "<p>No verified profiles found.</p>";

      return;
    }

    profilesContainer.innerHTML =
      profiles
        .map(
          profile => {

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
                  <div
                    class="profile-photo-placeholder"
                  >
                    No Photo
                  </div>
                `;

            return `
              <div
                class="profile-card"
              >

                ${photo}

                <h3>
                  ${escapeHtml(
                    profile.name ||
                    ""
                  )}
                </h3>

                <p>
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
                         
