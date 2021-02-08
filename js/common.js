$(function(){
	var blur = $(window).scrollTop()/45+2;
	$(".page-blur-container").css({"backdrop-filter":"blur("+blur+"px)","-webkit-backdrop-filter":"blur("+blur+"px)"});
	if($(window).scrollTop()>0){
		$(".back-to-top").css("right","10px");
	}else{
		$(".back-to-top").css("right","-100px");
	}
	var footer = `
	Copyright &copy 2021 别调P(小惠) All rights reserved.
	`;
	$(".foot").html(footer)
});
$(document).on('pjax:send', function() {
	$("#content-page").css({"opacity":0});
});
$(document).on('pjax:complete', function() { 
	$("#content-page").css({"opacity":1});
});
$(document).pjax('a[data-pjax]', '#content-page', {fragment: '#content-page',timeout: 8000,scrollTo:false});
$(".item").click(function(){
	$(".item").removeClass("active");
	$(this).addClass("active");
});
$('.tip-to-down').click(function(){
	$('html,body').animate({
		scrollTop:$('.main-content').offset().top
	}, 800);
});
$(window).scroll(function(){
	var blur = $(window).scrollTop()/45+2;
	$(".page-blur-container").css({"backdrop-filter":"blur("+blur+"px)","-webkit-backdrop-filter":"blur("+blur+"px)"});
	if($(window).scrollTop()>0){
		$(".back-to-top").css("right","10px");
	}else{
		$(".back-to-top").css("right","-100px");
	}
});
$(".back-to-top").click(function(){
	$('html,body').animate({
		scrollTop:0
	}, 600);
})