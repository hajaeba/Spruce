window.onload = function() {
  const users = [
    { name: "Alice", email: "alice@example.com", followers: 120, following: 50 },
    { name: "Bob", email: "bob@example.com", followers: 95, following: 80 },
    { name: "Charlie", email: "charlie@example.com", followers: 200, following: 180 },
    { name: "Diana", email: "diana@example.com", followers: 150, following: 90 },
    { name: "Evan", email: "evan@example.com", followers: 80, following: 60 },
    { name: "Fiona", email: "fiona@example.com", followers: 300, following: 250 },
    { name: "George", email: "george@example.com", followers: 45, following: 70 },
    { name: "Hannah", email: "hannah@example.com", followers: 230, following: 200 },
    { name: "Ian", email: "ian@example.com", followers: 60, following: 55 },
    { name: "Jane", email: "jane@example.com", followers: 90, following: 100 }
  ];

  const userListDiv = document.getElementById("userList");

  users.forEach(user => {
    const userDiv = document.createElement("div");
    userDiv.className = "user-card";
    userDiv.innerHTML = `
      <h3>${user.name}</h3>
      <p>Email: ${user.email}</p>
      <p>Followers: ${user.followers}</p>
      <p>Following: ${user.following}</p>
      <hr>
    `;
    userListDiv.appendChild(userDiv);
  });
};
