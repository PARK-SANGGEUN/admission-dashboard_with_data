
fetch('./data/admission_data_full_cleaned.csv')
  .then(response => response.text())
  .then(data => {
    document.body.innerHTML += `<pre style='font-size:12px;'>${data.slice(0, 1000)}...</pre>`;
  });
