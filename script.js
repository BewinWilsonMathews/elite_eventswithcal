function calculateEndTime(startTime, hours) {
  const [h, m] = startTime.split(":").map(Number);
  const end = new Date();
  end.setHours(h, m || 0);
  end.setHours(end.getHours() + hours);
  return `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
}

function updateTimeOnly() {
  const startTime = document.getElementById("startTime").value;
  const hours = parseInt(document.getElementById("hoursCount").value) || 0;
  document.getElementById("endTime").value = startTime && hours ? calculateEndTime(startTime, hours) : "";
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

async function updateAvailableStartTimes() {
  const date = document.getElementById("date").value;
  const hours = parseInt(document.getElementById("hoursCount").value);
  const override = document.getElementById("adminOverride")?.checked;
  const startTimeDropdown = document.getElementById("startTime");
  const message = document.getElementById("bookingMessage");
  const bookedList = document.getElementById("bookedTimesList");

  if (!date || !hours) return;

  const snapshot = await db.collection("bookings").where("date", "==", date).get();
  const bookings = snapshot.docs.map(doc => doc.data());

  // Show booked slots
  bookedList.innerHTML = bookings.length === 0
    ? "<li>No bookings yet.</li>"
    : bookings.map(b => `<li>${b.startTime} – ${b.endTime}</li>`).join("");

  const allSlots = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  const available = allSlots.filter(start => {
    const startM = timeToMinutes(start);
    const endM = startM + hours * 60;

    if (override) return true;

    for (const b of bookings) {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      if (timesOverlap(startM, endM, bStart, bEnd)) return false;
    }

    return endM <= 24 * 60;
  });

  startTimeDropdown.innerHTML = "";
  if (available.length === 0) {
    message.textContent = "Sorry, this date is fully booked for that duration.";
    startTimeDropdown.innerHTML = `<option value="">--No Available Time--</option>`;
  } else {
    message.textContent = "";
    startTimeDropdown.innerHTML = `<option value="">--Select Time--</option>` + available.map(t =>
      `<option value="${t}">${t}</option>`).join("");
  }

  updateTimeOnly();
}

document.getElementById("bookingForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value;
  const surname = document.getElementById("surname").value;
  const phoneNumber = document.getElementById("phoneNumber").value;
  const email = document.getElementById("email").value;
  const eventType = document.getElementById("eventType").value;
  const otherEventType = document.getElementById("otherEventType")?.value || "";
  const eventLabel = eventType === "other" ? `Other (${otherEventType})` : eventType;
  const hours = parseInt(document.getElementById("hoursCount").value) || 0;
  const date = document.getElementById("date").value;
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const catering = document.getElementById("cateringService").checked ? "Yes" : "No";

  const bookingData = {
    firstName, surname, phoneNumber, email,
    eventType: eventLabel,
    durationHours: hours,
    date, startTime, endTime,
    cateringService: catering,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("bookings").add(bookingData)
    .then(() => {
      Swal.fire({
  title: 'Booking Confirmed!',
  html: `
    <p><strong>${firstName} ${surname}</strong>, your booking is saved.</p>
    <p><b>Event:</b> ${eventLabel}</p>
    <p><b>Date:</b> ${date}</p>
    <p><b>Time:</b> ${startTime} – ${endTime}</p>
  `,
  icon: 'success',
  confirmButtonText: 'OK',
});
      document.getElementById("bookingForm").reset();
      document.getElementById("endTime").value = "";
      document.getElementById("bookedTimesList").innerHTML = "";
      document.getElementById("bookingMessage").textContent = "";

      const params = {
        to_email: email,
        to_name: `${firstName} ${surname}`,
        event_type: eventLabel,
        durationHours: hours,
        date, start_time: startTime, end_time: endTime,
        phone: phoneNumber,
        catering_service: catering
      };

      emailjs.send("service_fttp7ie", "template_1024so3", params);
      emailjs.send("service_fttp7ie", "template_id8umqi", {
        ...params,
        customer_email: email,
        to_email: "eliteeventsandcaterers@outlook.ie"
      });
    })
    .catch(err => alert("Booking failed: " + err.message));
});

document.addEventListener("DOMContentLoaded", () => {
  if (location.href.includes("override=true")) {
    document.getElementById("overrideContainer").style.display = "block";
  }

  const hours = document.getElementById("hoursCount");
  const startTime = document.getElementById("startTime");

  hours.addEventListener("change", updateAvailableStartTimes);
  document.getElementById("date").addEventListener("change", updateAvailableStartTimes);
  startTime.addEventListener("change", updateTimeOnly);

  db.collection("bookings").get().then(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const d = doc.data().date;
      counts[d] = (counts[d] || 0) + 1;
    });

    const fullDays = Object.keys(counts).filter(d => counts[d] >= 24);
    flatpickr("#date", {
      dateFormat: "Y-m-d",
      disable: fullDays,
      minDate: "today",
      onChange: updateAvailableStartTimes
    });
  });
});
