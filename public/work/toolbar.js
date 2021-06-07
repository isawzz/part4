var Toolbar;
function openToolbar(){
	let d=mBy('dLeiste');
	show(d);
	mStyleX(d,{w:100});
	Toolbar = new ToolbarClass(d);

}

class ToolbarClass{
	constructor(dParent){
		this.dParent = dParent;
		clearElement(dParent);
		this.buttons={};
		this.populate();
	
	}
	addButton(key,handler,caption){
		if (nundef(caption)) caption = key;
		
		let b=this.buttons[key]=mButton(caption,handler,this.dParent,null,null,'b_'+key);
	}
	removeButton(){}
	showButton(){}
	hideButton(){}
	populate(){
		this.addButton('uploadBoard',onClickUploadBoard,'upload board');
		this.addButton('uploadPerlen',onClickUploadPerlen,'upload perlen');
		this.addButton('chooseBoard',onClickChooseBoard,'choose board');
	}
}









