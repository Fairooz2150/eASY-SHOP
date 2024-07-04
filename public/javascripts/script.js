function addToCart(proId) {
    $.ajax({
      url: '/add-to-cart/' + proId,
      method: 'get',
      success: (response) => {
        if (response.status) {
          let count = $('#cart-count').html();
          count = parseInt(count) + 1;
          $("#cart-count").html(count);
  
          var ad = document.getElementById("Ad");
  
          // Add the "show" class to DIV
          ad.className = "show";
  
          // After 3 seconds, remove the show class from DIV
          setTimeout(function () { ad.className = ad.className.replace("show", ""); }, 3000);
        } 
      }
    })
  }
  