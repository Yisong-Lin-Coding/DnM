

export default function Header() {

    return(
        <div class="bg-black w-full h-full text-white text-center flex justify-between p-4 item-center">
           
          <div className="relative inline-block">
           <div
        className="p-4 text-white cursor-pointer"
        onClick={() => setIsPinned(!isPinned)}>
              Menu
            </div>

            <div 
            className={`absolute top-full left-0 mt-2 p-4 bg-gray-200 rounded shadow-lg transition-opacity duration-200
            ${isPinned ? "opacity-100 visible" : "invisible opacity-0 group-hover:visible group-hover:opacity-100"}`}>

                <div>
                    1
                </div>
                <div>
                    2

                </div>
                <div>
                    3

                </div>

            </div>
          </div> 
            
        <div className='text-center'>
            Page name
        </div>

        <div>
            Right
        </div>

      </div>
    )
}