import Caver from "caver-js"
import { Spinner } from "spin.js"

const config = {
  rpcURL: 'https://api.baobab.klaytn.net:8651'
}
const cav = new Caver(config.rpcURL);
const additionGameContract = new cav.klay.Contract(DEPLOYED_ABI, DEPLOYED_ADDRESS);
const App = {
  auth: {
    accessType: 'keystore',
    keystore: '',
    password: ''
  },
  start: async function () {
    const walletFromSession = sessionStorage.getItem('walletInstance');
    if (walletFromSession) {
      try {
        cav.klay.accounts.wallet.add(JSON.parse(walletFromSession));
        this.changeUI(JSON.parse(walletFromSession));
      } catch (e) {
        sessionStorage.removeItem('walletInstance');
      }
    }
  },

  handleImport: async function () {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0]);
    fileReader.onload = (event) => {
      try {
        if (!this.checkValidKeystore(event.target.result)) {
          $('#message').text('유효하지 않은 keystore 파일입니다.');
          return;
        }
        this.auth.keystore = event.target.result;
        $('#message').text('keystore 통과. 비밀번호를 입력하세요.');
        document.querySelector('#input-password').focus()
      } catch (event) {
        $('#message').text('유효하지 않은 keystore 파일입니다.');
        return;
      }
    }
  },

  handlePassword: async function () {
    this.auth.password = event.target.value;
  },

  handleLogin: async function () {
    if (this.auth.accessType === 'keystore') {
      try {
        const privateKey = cav.klay.accounts.decrypt(this.auth.keystore, this.auth.password).privateKey;
        this.integrateWallet(privateKey);
        
      } catch (e) {
        $('#message').text('비밀번호가 일치하지 않습니다.');
      }
    }
  },

  handleLogout: async function () {
    this.removeWallet();
    location.reload();
  },

  generateNumbers: async function () {
    var num1 = Math.floor((Math.random() * 50) + 10);
    var num2 = Math.floor((Math.random() * 50) + 10);
    sessionStorage.setItem('result', num1 + num2);

    $('#start').hide();
    $('#num1').text(num1);
    $('#num2').text(num2);
    $('#question').show();
    document.querySelector('#answer').focus();

    this.showTimer();
  },

  submitAnswer: async function () {
    const result = sessionStorage.getItem('result');
    var answer = $('#answer').val();
    if (answer === result) {
      if (confirm("대단합니다. 0.1 KLAY 받기")) {
        if (await this.callContractBalance() >= 0.1) {
          this.receiveKlay()
        } else {
          alert("죄송합니다. klay가 없습니다.");
        }
      }
    } else {
      alert("땡!")
    }

  },

  deposit: async function () {
    var spinner = this.showSpinner()
    const walletInstance = this.getWallet();

    if (walletInstance) {
      if ((await this.callOwner()).toUpperCase() !== walletInstance.address.toUpperCase()) return;
      else {
        var amount = $('#amount').val();
        if (amount) {
          additionGameContract.methods.deposit().send({
            from: walletInstance.address,
            gas: '250000',
            value: cav.utils.toPeb(amount, "KLAY")
          })
          .once('transactionHash', (txHash) => {
            console.log(`txHash: ${txHash}`)
          })
          .once('receipt', (receipt) => {
            console.log(`(#${receipt.blockNumber})`, receipt);
            spinner.stop();
            alert(amount + " KLAY를 컨트랙에 송금했습니다.");
            location.reload()
          })
          .once('error', (error) => {
            alert(error.message)
          })
        }
        return;
      }
    }

  },

  callOwner: async function () {
    return await additionGameContract.methods.owner().call();
  },

  callContractBalance: async function () {
    return await additionGameContract.methods.getBalance().call();
  },

  getWallet: function () {
    if (cav.klay.accounts.wallet.length){
      return cav.klay.accounts.wallet[0]
    }
  },

  checkValidKeystore: function (keystore) {
    const parsedKeystore = JSON.parse(keystore);
    const isValidKeystore = parsedKeystore.version && parsedKeystore.id && parsedKeystore.address;

    return isValidKeystore;
  },

  integrateWallet: function (privateKey) {
    const walletInstance = cav.klay.accounts.privateKeyToAccount(privateKey);
    cav.klay.accounts.wallet.add(walletInstance);
    sessionStorage.setItem('walletInstance', JSON.stringify(walletInstance));
    this.changeUI(walletInstance);
  },

  reset: function () {
    this.auth = {
      keystore: '',
      password: ''
    }
  },

  changeUI: async function (walletInstance) {
    $('#loginModal').modal('hide');
    $('#login').hide();
    $('#logout').show();
    $('#game').show();
    $('#address').append('<br>' + '<p>' + '내 계졍 주쇠: ' + walletInstance.address + '</p>');
    $('#contractBalance')
    .append('<br>' + '<p>' + '이벤트 잔액: ' + cav.utils.fromPeb(await this.callContractBalance(), "KLAY") + ' KLAY' + '</p>');

    if ((await this.callOwner()).toUpperCase() === walletInstance.address.toUpperCase()) {
      $('#owner').show();
    }

  },

  removeWallet: function () {
    cav.klay.accounts.wallet.clear();
    sessionStorage.removeItem('walletInstance');
    this.reset();
  },

  showTimer: function () {
    var seconds = 3;
    $('#timer').text(seconds);

    var interval = setInterval(() => {
      $('#timer').text(--seconds);
      if(seconds <=0) {
        $('#timer').text('');
        $('#answer').val('');
        $('#question').hide();
        $('#start').show();
        clearInterval(interval);
      }
    }, 1000);
  },

  showSpinner: function () {
    var target = document.getElementById("spin");
    return new Spinner(opts).spin(target);
  },

  receiveKlay: function () {
    var spinner = this.showSpinner();
    const walletInstance = this.getWallet();

    if (!walletInstance) return;

    additionGameContract.methods.transfer(cav.utils.toPeb("0.1", "KLAY")).send({
      from: walletInstance.address,
      gas: '250000'
    }).then(function (receipt) {
      if (receipt.status) {
        console.log(receipt);
        spinner.stop();
        alert("0.1 KLAY가 " + walletInstance.address + " 계정으로 지급되었습니다.");
        $('#transaction').html("");
        $('#transaction')
        .append(`<p><a href='https://baobab.klaytnscope.com/tx/${receipt.transactionHash}'
                       target='_black'> 클레이튼 scope에서 트랜젝션 확인</a></p>`)

        return additionGameContract.methods.getBalance().call()
          .then(function (balance) {
            $('#contractBalance').html("");
            $('#contractBalance').append('<p>' + '이벤트 잔액: ' + cav.utils.fromPeb(balance, "KLAY") + ' KLAY' + '</p>');
          })
      }
    })
  }
};

window.App = App;

window.addEventListener("load", function () {
  App.start();
});

var opts = {
  lines: 10, // The number of lines to draw
  length: 30, // The length of each line
  width: 17, // The line thickness
  radius: 45, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: '#5bc0de', // CSS color or array of colors
  fadeColor: 'transparent', // CSS color or array of colors
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: 'spinner', // The CSS class to assign to the spinner
  top: '50%', // Top position relative to parent
  left: '50%', // Left position relative to parent
  shadow: '0 0 1px transparent', // Box-shadow for the lines
  position: 'absolute' // Element positioning
};