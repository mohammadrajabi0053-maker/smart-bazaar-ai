<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بازار هوشمند</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Tahoma,Arial;background:#f4f6f8;color:#222}
header{background:#087f5b;color:white;padding:22px 15px;text-align:center}
header h1{margin:0 0 10px}
header p{margin:0}
.search{padding:18px;text-align:center}
input{width:90%;max-width:500px;padding:13px;border:1px solid #ccc;border-radius:10px;font-size:16px}
h2{text-align:center;color:#087f5b}
.categories{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;padding:10px}
.categories button{border:0;background:#d8f3e8;color:#087f5b;padding:12px 18px;border-radius:20px;font-size:15px}
.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:14px;padding:15px}
.card{background:white;border-radius:12px;padding:15px;text-align:center;box-shadow:0 2px 8px #0001}
.pic{font-size:55px;padding:15px}
.card h3{font-size:16px}
.price{color:#087f5b;font-weight:bold}
.card button{background:#087f5b;color:white;border:0;border-radius:8px;padding:10px;width:100%}
footer{background:#173b32;color:white;text-align:center;padding:22px;margin-top:25px}
</style>
</head>
<body>

<header>
<h1>🛍️ بازار هوشمند</h1>
<p>بازار آنلاین خرید و فروش</p>
</header>

<div class="search">
<input id="search" type="search" placeholder="نام محصول را جست‌وجو کنید...">
</div>

<h2>دسته‌بندی کالاها</h2>
<div class="categories">
<button onclick="filter('همه')">همه کالاها</button>
<button onclick="filter('موبایل')">موبایل</button>
<button onclick="filter('پوشاک')">پوشاک</button>
<button onclick="filter('خانه')">خانه</button>
</div>

<h2>محصولات فروشگاه</h2>
<div class="products" id="products">

<div class="card" data-category="موبایل">
<div class="pic">📱</div>
<h3>گوشی هوشمند</h3>
<p class="price">قیمت: نمونه</p>
<button onclick="alert('برای خرید، به‌زودی امکان ثبت سفارش اضافه می‌شود.')">مشاهده محصول</button>
</div>

<div class="card" data-category="پوشاک">
<div class="pic">👕</div>
<h3>لباس مردانه</h3>
<p class="price">قیمت: نمونه</p>
<button onclick="alert('برای خرید، به‌زودی امکان ثبت سفارش اضافه می‌شود.')">مشاهده محصول</button>
</div>

<div class="card" data-category="خانه">
<div class="pic">🏠</div>
<h3>وسایل خانه</h3>
<p class="price">قیمت: نمونه</p>
<button onclick="alert('برای خرید، به‌زودی امکان ثبت سفارش اضافه می‌شود.')">مشاهده محصول</button>
</div>

</div>

<footer>
<p>بازار هوشمند | خرید آسان، فروش هوشمند</p>
<p>فارسی | English | العربية</p>
</footer>

<script>
const cards = document.querySelectorAll('.card');

function filter(category){
cards.forEach(card=>{
card.style.display =
category === 'همه' || card.dataset.category === category
? 'block' : 'none';
});
}

document.getElementById('search').addEventListener('input',function(){
const value=this.value.trim().toLowerCase();
cards.forEach(card=>{
card.style.display=card.innerText.toLowerCase().includes(value)
? 'block' : 'none';
});
});
</script>

</body>
</html>
